import { Request } from 'express'
import { StatusCodes } from 'http-status-codes'
import { Equal } from 'typeorm'
import { InternalFlowiseError } from '../errors/internalFlowiseError'

/** Every stored item belongs to a workspace; queries must always be scoped to one */
export const getWorkspaceSearchOptions = (workspaceId?: string) => {
    if (!workspaceId) throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Workspace ID is required')
    return { workspaceId: Equal(workspaceId) }
}

export const getActiveWorkspaceIdForRequest = (req: Request): string => {
    const workspaceId = req.user?.activeWorkspaceId
    if (!workspaceId) throw new InternalFlowiseError(StatusCodes.UNAUTHORIZED, 'Unauthorized')
    return workspaceId
}

export const getWorkspaceSearchOptionsFromReq = (req: Request) => getWorkspaceSearchOptions(req.user?.activeWorkspaceId)
