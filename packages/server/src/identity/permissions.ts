import { NextFunction, Request, Response } from 'express'
import { GeneralErrorMessage } from '../utils/constants'

/**
 * Permissions an API key can be granted. The keys are stored in the `apikey.permissions`
 * column, so they must stay compatible with keys created by Flowise 3.x.
 */
const ACTIONS: Record<string, string> = {
    view: 'View',
    create: 'Create',
    update: 'Update',
    duplicate: 'Duplicate',
    delete: 'Delete',
    export: 'Export',
    import: 'Import',
    config: 'Edit configuration',
    domains: 'Allowed domains',
    run: 'Run',
    'add-loader': 'Add loader',
    'delete-loader': 'Delete loader',
    'preview-process': 'Preview and process',
    'upsert-config': 'Upsert configuration',
    marketplace: 'Marketplace templates',
    custom: 'Custom templates',
    'custom-delete': 'Delete custom templates',
    toolexport: 'Export tools as templates',
    flowexport: 'Export flows as templates'
}

const FLOW_ACTIONS = ['view', 'create', 'update', 'duplicate', 'delete', 'export', 'import', 'config', 'domains']
const CRUD = ['view', 'create', 'update', 'delete']

const CATALOG: Record<string, string[]> = {
    chatflows: FLOW_ACTIONS,
    agentflows: FLOW_ACTIONS,
    tools: [...CRUD, 'export'],
    assistants: CRUD,
    credentials: CRUD,
    variables: CRUD,
    apikeys: CRUD,
    documentStores: [...CRUD, 'add-loader', 'delete-loader', 'preview-process', 'upsert-config'],
    datasets: CRUD,
    evaluators: CRUD,
    evaluations: ['view', 'create', 'delete', 'run'],
    executions: ['view', 'update', 'delete'],
    templates: ['marketplace', 'custom', 'custom-delete', 'toolexport', 'flowexport'],
    workspace: ['export', 'import'],
    logs: ['view']
}

export type PermissionItem = { key: string; value: string; isOpenSource: boolean; isEnterprise: boolean; isCloud: boolean }

// Export/import of the whole workspace is for the owner only (services/apikey refuses workspace:* keys)
const OWNER_ONLY_CATEGORIES = ['workspace']

/** Grouped the way the API key dialog in the UI expects it */
export const getPermissionCatalog = (type?: string): Record<string, PermissionItem[]> => {
    const catalog: Record<string, PermissionItem[]> = {}
    for (const [category, actions] of Object.entries(CATALOG)) {
        if (type === 'API_KEY' && OWNER_ONLY_CATEGORIES.includes(category)) continue
        catalog[category] = actions.map((action) => ({
            key: `${category}:${action}`,
            value: ACTIONS[action] ?? action,
            isOpenSource: true,
            isEnterprise: true,
            isCloud: true
        }))
    }
    return catalog
}

export const ALL_PERMISSIONS: string[] = Object.entries(CATALOG).flatMap(([category, actions]) =>
    actions.map((action) => `${category}:${action}`)
)

const hasAny = (req: Request, required: string[]): boolean => {
    const user = req.user
    if (!user) return false
    // The signed-in owner can do everything; API keys only what they were granted.
    if (user.isOrganizationAdmin) return true
    const granted = user.permissions ?? []
    return required.some((permission) => granted.includes(permission))
}

const deny = (res: Response) => res.status(403).json({ message: GeneralErrorMessage.FORBIDDEN })

export const checkPermission = (permission: string) => (req: Request, res: Response, next: NextFunction) =>
    hasAny(req, [permission]) ? next() : deny(res)

/** `permissions` is a comma separated list; any one of them is enough */
export const checkAnyPermission = (permissions: string) => {
    const required = permissions.split(',').map((permission) => permission.trim())
    return (req: Request, res: Response, next: NextFunction) => (hasAny(req, required) ? next() : deny(res))
}

/** For endpoints no API key should reach, such as the queue dashboard */
export const requireOwner = (req: Request, res: Response, next: NextFunction) =>
    req.user?.isOrganizationAdmin && req.user.id ? next() : deny(res)
