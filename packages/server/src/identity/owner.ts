import { StatusCodes } from 'http-status-codes'
import { DataSource, EntityManager } from 'typeorm'
import { v4 as uuidv4 } from 'uuid'
import { AuthSession } from '../database/entities/AuthSession'
import { Organization, DEFAULT_ORGANIZATION_NAME } from '../database/entities/Organization'
import { User, UserStatus } from '../database/entities/User'
import { Workspace, DEFAULT_WORKSPACE_NAME } from '../database/entities/Workspace'
import { InternalFlowiseError } from '../errors/internalFlowiseError'
import { getRunningExpressApp } from '../utils/getRunningExpressApp'
import logger from '../utils/logger'
import { AuthErrorMessage, LoggedInUser } from './Interface'
import { burnPasswordCheck, hashPassword, isValidEmail, passwordProblems, verifyPassword } from './password'
import { ALL_PERMISSIONS } from './permissions'
import { endAllSessions } from './session'

/**
 * Keelflow has one account: the owner. Automation uses API keys.
 * The owner works in one organization and one workspace, the layout Flowise 3.x
 * used for its open source edition, so existing databases carry over as they are.
 */

/** Paid features of the hosted edition whose code is open source; all on in Keelflow */
export const COMMUNITY_FEATURES: Record<string, string> = {
    'feat:datasets': 'true',
    'feat:evaluators': 'true',
    'feat:evaluations': 'true',
    'feat:logs': 'true',
    'feat:account': 'true'
}

// Tables whose rows belong to a workspace. Rows without one (from Flowise 2.x) are
// given to the owner's workspace when the owner account is created.
const WORKSPACE_TABLES = [
    'chat_flow',
    'tool',
    'assistant',
    'credential',
    'variable',
    'apikey',
    'document_store',
    'dataset',
    'evaluation',
    'evaluator',
    'custom_template',
    'execution'
]

export type OwnerContext = { owner: User; organization: Organization; workspace: Workspace }

let cachedContext: OwnerContext | undefined

export const forgetOwnerContext = () => {
    cachedContext = undefined
}

const dataSource = (): DataSource => getRunningExpressApp().AppDataSource

const pickOwner = async (ds: DataSource, organization: Organization): Promise<User | null> => {
    const users = ds.getRepository(User)
    const creator = await users.findOneBy({ id: organization.createdBy })
    if (creator && creator.status !== UserStatus.DELETED) return creator
    // Databases coming from Flowise Enterprise may have several users: take the oldest active one
    return users.findOne({ where: { status: UserStatus.ACTIVE }, order: { createdDate: 'ASC' } })
}

export const getOwnerContext = async (): Promise<OwnerContext | undefined> => {
    if (cachedContext) return cachedContext
    const ds = dataSource()
    const organization = await ds.getRepository(Organization).findOne({ where: {}, order: { createdDate: 'ASC' } })
    if (!organization) return undefined
    const owner = await pickOwner(ds, organization)
    if (!owner) return undefined

    const workspaces = ds.getRepository(Workspace)
    const preferred = process.env.KEELFLOW_WORKSPACE_ID
    const workspace =
        (preferred && (await workspaces.findOneBy({ id: preferred, organizationId: organization.id }))) ||
        (await workspaces.findOne({ where: { organizationId: organization.id }, order: { createdDate: 'ASC' } }))
    if (!workspace) return undefined

    cachedContext = { owner, organization, workspace }
    return cachedContext
}

export const ownerExists = async (): Promise<boolean> => (await getOwnerContext()) !== undefined

export const toLoggedInUser = (ctx: OwnerContext): LoggedInUser => ({
    id: ctx.owner.id,
    email: ctx.owner.email,
    name: ctx.owner.name,
    activeOrganizationId: ctx.organization.id,
    activeOrganizationSubscriptionId: '',
    activeOrganizationCustomerId: '',
    activeOrganizationProductId: '',
    isOrganizationAdmin: true,
    activeWorkspaceId: ctx.workspace.id,
    activeWorkspace: ctx.workspace.name,
    assignedWorkspaces: [{ id: ctx.workspace.id, name: ctx.workspace.name, role: 'owner', organizationId: ctx.organization.id }],
    permissions: [...ALL_PERMISSIONS],
    features: { ...COMMUNITY_FEATURES }
})

/** What the UI stores after signing in */
export const toSessionPayload = (ctx: OwnerContext) => ({
    ...toLoggedInUser(ctx),
    status: ctx.owner.status,
    role: 'owner',
    isSSO: false
})

export const publicUser = (user: User) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    status: user.status,
    createdDate: user.createdDate,
    updatedDate: user.updatedDate
})

let registering = false

export const registerOwner = async (input: { name?: unknown; email?: unknown; credential?: unknown }): Promise<User> => {
    const name = typeof input.name === 'string' ? input.name.trim() : ''
    const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : ''
    if (!name || name.length > 100) throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Name is required (up to 100 characters)')
    if (!isValidEmail(email)) throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'A valid email is required')
    const problems = passwordProblems(input.credential)
    if (problems.length) throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, problems.join(', '))

    if (registering) throw new InternalFlowiseError(StatusCodes.CONFLICT, AuthErrorMessage.OWNER_EXISTS)
    registering = true
    try {
        const ds = dataSource()
        // Any existing account closes registration, even if it is not usable as the owner
        if ((await ds.getRepository(User).count()) > 0) {
            throw new InternalFlowiseError(StatusCodes.CONFLICT, AuthErrorMessage.OWNER_EXISTS)
        }
        const credential = await hashPassword(input.credential as string)

        const owner = await ds.transaction(async (manager) => {
            const user = manager.create(User, { name, email, credential, status: UserStatus.ACTIVE, createdBy: '', updatedBy: '' })
            user.id = uuidv4()
            user.createdBy = user.id
            user.updatedBy = user.id
            await manager.save(user)

            let organization = await manager.findOne(Organization, { where: {}, order: { createdDate: 'ASC' } })
            if (!organization) {
                organization = await manager.save(
                    manager.create(Organization, { name: DEFAULT_ORGANIZATION_NAME, createdBy: user.id, updatedBy: user.id })
                )
            }
            let workspace = await manager.findOne(Workspace, { where: { organizationId: organization.id }, order: { createdDate: 'ASC' } })
            if (!workspace) {
                workspace = await manager.save(
                    manager.create(Workspace, {
                        name: DEFAULT_WORKSPACE_NAME,
                        organizationId: organization.id,
                        createdBy: user.id,
                        updatedBy: user.id
                    })
                )
            }
            await adoptOrphanRows(manager, workspace.id)
            return user
        })
        forgetOwnerContext()
        logger.info(`[auth]: owner account created for ${email}`)
        return owner
    } finally {
        registering = false
    }
}

const adoptOrphanRows = async (manager: EntityManager, workspaceId: string) => {
    const queryRunner = manager.queryRunner ?? manager.connection.createQueryRunner()
    const column = manager.connection.driver.escape('workspaceId')
    for (const table of WORKSPACE_TABLES) {
        if (!(await queryRunner.hasColumn(table, 'workspaceId'))) continue
        const result = await manager.createQueryBuilder().update(table).set({ workspaceId }).where(`${column} IS NULL`).execute()
        if (result.affected) logger.info(`[auth]: moved ${result.affected} ${table} row(s) into the owner's workspace`)
    }
}

// ---------- sign-in throttling ----------

const WINDOW_MS = 15 * 60_000
const MAX_FAILURES = 10
const failures = new Map<string, { count: number; since: number }>()

const tooManyFailures = (key: string): boolean => {
    const entry = failures.get(key)
    if (!entry) return false
    if (Date.now() - entry.since > WINDOW_MS) {
        failures.delete(key)
        return false
    }
    return entry.count >= MAX_FAILURES
}

const recordFailure = (key: string) => {
    const entry = failures.get(key)
    if (!entry || Date.now() - entry.since > WINDOW_MS) failures.set(key, { count: 1, since: Date.now() })
    else entry.count += 1
    if (failures.size > 10_000) failures.clear()
}

export const checkCredentials = async (email: unknown, password: unknown, clientKey: string): Promise<OwnerContext> => {
    const normalized = typeof email === 'string' ? email.trim().toLowerCase() : ''
    const keys = [`ip:${clientKey}`, `email:${normalized}`]
    if (keys.some(tooManyFailures)) throw new InternalFlowiseError(StatusCodes.TOO_MANY_REQUESTS, AuthErrorMessage.TOO_MANY_ATTEMPTS)

    const fail = async (reason: string) => {
        keys.forEach(recordFailure)
        logger.warn(`[auth]: failed sign-in for "${normalized.slice(0, 100)}" from ${clientKey}: ${reason}`)
        return new InternalFlowiseError(StatusCodes.UNAUTHORIZED, AuthErrorMessage.INVALID_CREDENTIALS)
    }

    if (typeof password !== 'string' || !normalized) throw await fail('missing email or password')
    const ctx = await getOwnerContext()
    if (!ctx) {
        await burnPasswordCheck(password)
        throw new InternalFlowiseError(StatusCodes.UNAUTHORIZED, AuthErrorMessage.SETUP_INCOMPLETE)
    }
    if (ctx.owner.email.toLowerCase() !== normalized) {
        await burnPasswordCheck(password)
        throw await fail('not the owner account')
    }
    if (!(await verifyPassword(password, ctx.owner.credential))) throw await fail('wrong password')

    keys.forEach((key) => failures.delete(key))
    return ctx
}

// ---------- profile ----------

export const updateOwnerProfile = async (
    userId: string,
    body: { name?: unknown; email?: unknown; oldPassword?: unknown; newPassword?: unknown; confirmPassword?: unknown }
): Promise<{ user: User; passwordChanged: boolean }> => {
    const ctx = await getOwnerContext()
    if (!ctx || ctx.owner.id !== userId) throw new InternalFlowiseError(StatusCodes.FORBIDDEN, 'Forbidden')
    const users = dataSource().getRepository(User)
    const user = await users.findOneByOrFail({ id: userId })
    const changes: Partial<User> = {}

    if (body.name !== undefined) {
        const name = typeof body.name === 'string' ? body.name.trim() : ''
        if (!name || name.length > 100) throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Name is required (up to 100 characters)')
        changes.name = name
    }
    if (body.email !== undefined) {
        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
        if (!isValidEmail(email)) throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'A valid email is required')
        changes.email = email
    }

    let passwordChanged = false
    if (body.newPassword !== undefined) {
        if (!(await verifyPassword(String(body.oldPassword ?? ''), user.credential))) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Current password is incorrect')
        }
        if (body.confirmPassword !== undefined && body.confirmPassword !== body.newPassword) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'New Password and Confirm Password do not match')
        }
        const problems = passwordProblems(body.newPassword)
        if (problems.length) throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, problems.join(', '))
        changes.credential = await hashPassword(body.newPassword as string)
        passwordChanged = true
    }

    if (Object.keys(changes).length) {
        changes.updatedBy = user.id
        await users.update({ id: user.id }, changes)
    }
    if (passwordChanged) await endAllSessions(user.id)
    forgetOwnerContext()
    return { user: await users.findOneByOrFail({ id: user.id }), passwordChanged }
}

/** Used by `keelflow user` to reset the owner's password from the command line */
export const resetOwnerPassword = async (ds: DataSource, email: string | undefined, password: string): Promise<User> => {
    const problems = passwordProblems(password)
    if (problems.length) throw new Error(problems.join(', '))
    const users = ds.getRepository(User)
    let user: User | null
    if (email) {
        user = await users.findOneBy({ email: email.trim().toLowerCase() })
        user ??= (await users.find()).find((u) => u.email.toLowerCase() === email.trim().toLowerCase()) ?? null
    } else {
        const organization = await ds.getRepository(Organization).findOne({ where: {}, order: { createdDate: 'ASC' } })
        user = organization ? await pickOwner(ds, organization) : null
    }
    if (!user) throw new Error(email ? `No account with email ${email}` : 'No owner account yet')
    await users.update({ id: user.id }, { credential: await hashPassword(password), status: UserStatus.ACTIVE })
    await ds.getRepository(AuthSession).delete({ userId: user.id })
    return user
}
