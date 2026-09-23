import { NextFunction, Request, Response } from 'express'
import { Workspace } from '../database/entities/Workspace'
import { getRunningExpressApp } from '../utils/getRunningExpressApp'
import { AuthErrorMessage, LoggedInUser } from './Interface'
import { COMMUNITY_FEATURES, getOwnerContext, toLoggedInUser } from './owner'
import { resolveSession } from './session'

/** The owner behind the session cookie, if any */
export const sessionUser = async (req: Request, res: Response): Promise<LoggedInUser | undefined> => {
    const userId = await resolveSession(req, res)
    if (!userId) return undefined
    const ctx = await getOwnerContext()
    if (!ctx || ctx.owner.id !== userId) return undefined
    return toLoggedInUser(ctx)
}

/** For requests from the web UI: a valid session is required */
export const requireSession = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = await sessionUser(req, res)
        if (!user) return res.status(401).json({ message: AuthErrorMessage.NOT_SIGNED_IN })
        req.user = user
        next()
    } catch (error) {
        next(error)
    }
}

/** For public endpoints: remembers who is signed in without requiring it */
export const attachSession = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = await sessionUser(req, res)
        if (user) req.user = user
    } catch {
        // public endpoints work without a session
    }
    next()
}

/** Who an API key acts as: its workspace, limited to the permissions it was given */
export const apiKeyUser = async (workspaceId: string, permissions: string[]): Promise<LoggedInUser | undefined> => {
    const workspace = await getRunningExpressApp().AppDataSource.getRepository(Workspace).findOneBy({ id: workspaceId })
    if (!workspace) return undefined
    return {
        id: '',
        email: '',
        name: '',
        activeOrganizationId: workspace.organizationId,
        activeOrganizationSubscriptionId: '',
        activeOrganizationCustomerId: '',
        activeOrganizationProductId: '',
        isOrganizationAdmin: false,
        activeWorkspaceId: workspace.id,
        activeWorkspace: workspace.name,
        assignedWorkspaces: [],
        permissions: Array.isArray(permissions) ? permissions : [],
        features: { ...COMMUNITY_FEATURES }
    }
}
