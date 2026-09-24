import { Request, Response } from 'express'
import { hashPassword, isValidEmail, passwordProblems, verifyPassword } from './password'
import { ALL_PERMISSIONS, checkAnyPermission, checkPermission, getPermissionCatalog, requireOwner } from './permissions'

const run = (middleware: (req: Request, res: Response, next: () => void) => unknown, user?: Partial<Request['user']>) => {
    const req = { user } as unknown as Request
    const res = { statusCode: 200, body: undefined as unknown } as any
    res.status = (code: number) => {
        res.statusCode = code
        return res
    }
    res.json = (body: unknown) => {
        res.body = body
        return res
    }
    let passed = false
    middleware(req, res as Response, () => {
        passed = true
    })
    return { passed, status: res.statusCode }
}

describe('password rules', () => {
    it('accepts a strong password', () => {
        expect(passwordProblems('Keel-flow-2026!')).toEqual([])
    })

    it('lists every missing requirement', () => {
        expect(passwordProblems('short')).toEqual(
            expect.arrayContaining([
                'Password must be at least 8 characters',
                'Password must contain at least one uppercase letter',
                'Password must contain at least one digit',
                'Password must contain at least one special character'
            ])
        )
        expect(passwordProblems(undefined)).toEqual(['Password is required'])
        expect(passwordProblems('A1!' + 'a'.repeat(200))).toContain('Password must not be more than 128 characters')
    })

    it('hashes with bcrypt and verifies', async () => {
        const hash = await hashPassword('Keel-flow-2026!')
        expect(hash).toMatch(/^\$2[aby]\$/)
        await expect(verifyPassword('Keel-flow-2026!', hash)).resolves.toBe(true)
        await expect(verifyPassword('keel-flow-2026!', hash)).resolves.toBe(false)
    })

    it('verifies hashes written by Flowise (bcryptjs, 10 rounds)', async () => {
        // Flowise 3.x stored bcryptjs hashes with 10 rounds
        const bcrypt = await import('bcryptjs')
        const flowiseHash = bcrypt.hashSync('Flowise-owner-1!', 10)
        await expect(verifyPassword('Flowise-owner-1!', flowiseHash)).resolves.toBe(true)
    })

    it('never throws on missing or broken hashes', async () => {
        await expect(verifyPassword('x', null)).resolves.toBe(false)
        await expect(verifyPassword('x', 'not-a-hash')).resolves.toBe(false)
    })

    it('validates email addresses', () => {
        expect(isValidEmail('owner@example.com')).toBe(true)
        expect(isValidEmail('owner@example')).toBe(false)
        expect(isValidEmail('a b@example.com')).toBe(false)
        expect(isValidEmail(42)).toBe(false)
    })
})

describe('permissions', () => {
    it('lets the owner through everywhere', () => {
        const owner = { id: 'u1', isOrganizationAdmin: true, permissions: [] }
        expect(run(checkPermission('credentials:view'), owner).passed).toBe(true)
        expect(run(checkAnyPermission('chatflows:delete,agentflows:delete'), owner).passed).toBe(true)
        expect(run(requireOwner, owner).passed).toBe(true)
    })

    it('limits API keys to what they were granted', () => {
        const key = { id: '', isOrganizationAdmin: false, permissions: ['chatflows:view'] }
        expect(run(checkPermission('chatflows:view'), key).passed).toBe(true)
        expect(run(checkAnyPermission('agentflows:view, chatflows:view'), key).passed).toBe(true)
        const denied = run(checkPermission('credentials:view'), key)
        expect(denied.passed).toBe(false)
        expect(denied.status).toBe(403)
        expect(run(requireOwner, key).passed).toBe(false)
    })

    it('denies requests without a user', () => {
        expect(run(checkPermission('chatflows:view')).status).toBe(403)
    })

    it('keeps the permission keys Flowise stored for API keys', () => {
        // Keys created by Flowise 3.x were given this list by the AddApiKeyPermission migration
        const flowiseDefaults = [
            'chatflows:view',
            'chatflows:config',
            'agentflows:domains',
            'tools:export',
            'documentStores:upsert-config',
            'executions:delete',
            'templates:flowexport'
        ]
        for (const key of flowiseDefaults) expect(ALL_PERMISSIONS).toContain(key)
    })

    it('describes permissions the way the API key dialog expects', () => {
        const catalog = getPermissionCatalog()
        expect(catalog.chatflows[0]).toEqual({
            key: 'chatflows:view',
            value: 'View',
            isOpenSource: true,
            isEnterprise: true,
            isCloud: true
        })
        expect(
            Object.values(catalog)
                .flat()
                .map((p) => p.key)
        ).toEqual(ALL_PERMISSIONS)
    })

    it('does not offer workspace export/import to API keys', () => {
        expect(getPermissionCatalog('API_KEY').workspace).toBeUndefined()
        expect(getPermissionCatalog().workspace).toBeDefined()
    })
})
