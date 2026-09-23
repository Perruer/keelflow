import express, { NextFunction, Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { InternalFlowiseError } from '../errors/internalFlowiseError'
import { AuthErrorMessage } from './Interface'
import { checkCredentials, getOwnerContext, ownerExists, publicUser, registerOwner, toSessionPayload, updateOwnerProfile } from './owner'
import { getPermissionCatalog } from './permissions'
import { sessionUser } from './middleware'
import { endSession, startSession } from './session'

type Handler = (req: Request, res: Response) => Promise<unknown>
const handle = (fn: Handler) => (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next)
}

const ownerOnly = (req: Request) => {
    if (!req.user?.id || !req.user.isOrganizationAdmin) {
        throw new InternalFlowiseError(StatusCodes.UNAUTHORIZED, AuthErrorMessage.NOT_SIGNED_IN)
    }
    return req.user
}

// ---------- /api/v1/auth ----------
export const authRouter = express.Router()

/** Where the sign-in page should go: owner setup on a fresh instance, sign-in otherwise */
authRouter.post(
    '/resolve',
    handle(async (_req, res) => {
        res.json({ redirectUrl: (await ownerExists()) ? '/signin' : '/organization-setup' })
    })
)

authRouter.post(
    '/login',
    handle(async (req, res) => {
        const ctx = await checkCredentials(req.body?.email, req.body?.password, req.ip || 'unknown')
        await startSession(req, res, ctx.owner.id)
        res.json(toSessionPayload(ctx))
    })
)

/** The UI calls this to check that the session is still alive */
authRouter.post(
    '/refreshToken',
    handle(async (req, res) => {
        const user = await sessionUser(req, res)
        const ctx = user ? await getOwnerContext() : undefined
        if (!ctx) {
            res.status(StatusCodes.UNAUTHORIZED).json({ message: AuthErrorMessage.NOT_SIGNED_IN })
            return
        }
        res.json(toSessionPayload(ctx))
    })
)

authRouter.get(
    ['/permissions/:type', '/:type'],
    handle(async (req, res) => {
        ownerOnly(req)
        res.json(getPermissionCatalog())
    })
)

// ---------- /api/v1/account ----------
export const accountRouter = express.Router()

/** Creates the owner on a fresh instance; closed once any account exists */
accountRouter.post(
    '/register',
    handle(async (req, res) => {
        const input = req.body?.user ?? req.body ?? {}
        const user = await registerOwner({ name: input.name, email: input.email, credential: input.credential ?? input.password })
        res.status(StatusCodes.CREATED).json({ message: 'Owner account created. Signing you in...', user: publicUser(user) })
    })
)

accountRouter.post(
    '/logout',
    handle(async (req, res) => {
        await endSession(req, res)
        res.json({ message: 'logged_out', redirectTo: '/login' })
    })
)

// ---------- /api/v1/user ----------
export const userRouter = express.Router()

userRouter.get(
    '/',
    handle(async (req, res) => {
        const owner = ownerOnly(req)
        const ctx = await getOwnerContext()
        if (!ctx || (req.query.id && req.query.id !== owner.id)) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'User not found')
        res.json(publicUser(ctx.owner))
    })
)

userRouter.put(
    '/',
    handle(async (req, res) => {
        const owner = ownerOnly(req)
        if (req.body?.id && req.body.id !== owner.id) throw new InternalFlowiseError(StatusCodes.FORBIDDEN, 'Forbidden')
        const { user, passwordChanged } = await updateOwnerProfile(owner.id, req.body ?? {})
        if (passwordChanged) await endSession(req, res)
        res.json({ user: publicUser(user) })
    })
)
