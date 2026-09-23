export type IAssignedWorkspace = { id: string; name: string; role: string; organizationId: string }

/**
 * What `req.user` holds for a signed-in owner or for a request made with an API key.
 * The field names follow Flowise 3.x so the web UI and the existing services keep working.
 */
export type LoggedInUser = {
    /** Empty for API key requests */
    id: string
    email: string
    name: string
    activeOrganizationId: string
    /** Kept for compatibility with services written for the hosted edition; always empty */
    activeOrganizationSubscriptionId: string
    activeOrganizationCustomerId: string
    activeOrganizationProductId: string
    /** True for the owner, false for API keys */
    isOrganizationAdmin: boolean
    activeWorkspaceId: string
    activeWorkspace: string
    assignedWorkspaces: IAssignedWorkspace[]
    permissions: string[]
    features: Record<string, string>
}

export enum AuthErrorMessage {
    INVALID_CREDENTIALS = 'Invalid email or password',
    OWNER_EXISTS = 'This instance already has an owner. Sign in instead.',
    NOT_SIGNED_IN = 'Unauthorized Access',
    TOO_MANY_ATTEMPTS = 'Too many sign-in attempts. Try again later.',
    SETUP_INCOMPLETE = 'No owner account yet. Open the app to create one.'
}
