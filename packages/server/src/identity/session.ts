import { createHash, randomBytes } from 'crypto'
import { Request, Response } from 'express'
import { DataSource, LessThan } from 'typeorm'
import { AuthSession } from '../database/entities/AuthSession'
import { getRunningExpressApp } from '../utils/getRunningExpressApp'
import logger from '../utils/logger'

export const SESSION_COOKIE = 'keelflow_session'

const minutes = (value: string | undefined, fallback: number): number => {
    const parsed = parseInt(value || '', 10)
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

/** Idle timeout: a session unused for this long ends. Default 7 days. */
const sessionLifetimeMs = () => minutes(process.env.SESSION_EXPIRY_IN_MINUTES, 7 * 24 * 60) * 60_000
/** Hard limit regardless of activity. Default 30 days. */
const sessionMaxAgeMs = () => minutes(process.env.SESSION_MAX_AGE_IN_MINUTES, 30 * 24 * 60) * 60_000
// Refresh lastUsedDate at most once a minute to avoid a write on every request
const TOUCH_INTERVAL_MS = 60_000

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

const repo = () => getRunningExpressApp().AppDataSource.getRepository(AuthSession)

const secureCookiesFor = (req: Request): boolean => {
    const setting = process.env.SECURE_COOKIES
    if (setting === 'true') return true
    if (setting === 'false') return false
    return req.secure
}

const setCookie = (req: Request, res: Response, token: string, expiresAt: Date) => {
    res.cookie(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: secureCookiesFor(req),
        path: '/',
        expires: expiresAt
    })
}

export const clearSessionCookie = (req: Request, res: Response) => {
    res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: 'lax', secure: secureCookiesFor(req), path: '/' })
}

export const startSession = async (req: Request, res: Response, userId: string): Promise<void> => {
    const token = randomBytes(32).toString('base64url')
    const now = new Date()
    const expiresAt = new Date(now.getTime() + sessionLifetimeMs())
    await repo().insert({
        id: hashToken(token),
        userId,
        createdDate: now,
        lastUsedDate: now,
        expiresAt,
        userAgent: (req.headers['user-agent'] || '').slice(0, 255) || null,
        ip: (req.ip || '').slice(0, 64) || null
    })
    setCookie(req, res, token, expiresAt)
}

/** Returns the user id behind the session cookie, extending the session while it is used */
export const resolveSession = async (req: Request, res: Response): Promise<string | undefined> => {
    const token = req.cookies?.[SESSION_COOKIE]
    if (!token || typeof token !== 'string' || token.length > 100) return undefined

    const id = hashToken(token)
    const session = await repo().findOneBy({ id })
    if (!session) return undefined

    const now = Date.now()
    const created = new Date(session.createdDate).getTime()
    if (new Date(session.expiresAt).getTime() <= now || created + sessionMaxAgeMs() <= now) {
        await repo().delete({ id })
        return undefined
    }

    if (now - new Date(session.lastUsedDate).getTime() > TOUCH_INTERVAL_MS) {
        const expiresAt = new Date(Math.min(now + sessionLifetimeMs(), created + sessionMaxAgeMs()))
        await repo().update({ id }, { lastUsedDate: new Date(now), expiresAt })
        setCookie(req, res, token, expiresAt)
    }
    return session.userId
}

export const endSession = async (req: Request, res: Response): Promise<void> => {
    const token = req.cookies?.[SESSION_COOKIE]
    if (token && typeof token === 'string') await repo().delete({ id: hashToken(token) })
    clearSessionCookie(req, res)
}

/** Signs the user out everywhere, e.g. after a password change */
export const endAllSessions = async (userId: string): Promise<void> => {
    await repo().delete({ userId })
}

export const purgeExpiredSessions = async (dataSource: DataSource): Promise<void> => {
    try {
        await dataSource.getRepository(AuthSession).delete({ expiresAt: LessThan(new Date()) })
    } catch (error) {
        logger.warn(`[auth]: could not purge expired sessions: ${error}`)
    }
}
