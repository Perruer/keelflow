import bcrypt from 'bcryptjs'

const MIN_LENGTH = 8
const MAX_LENGTH = 128

/** Same rules the UI checks before submitting, enforced again on the server */
export const passwordProblems = (password: unknown): string[] => {
    if (typeof password !== 'string') return ['Password is required']
    const problems: string[] = []
    if (password.length < MIN_LENGTH) problems.push(`Password must be at least ${MIN_LENGTH} characters`)
    if (password.length > MAX_LENGTH) problems.push(`Password must not be more than ${MAX_LENGTH} characters`)
    if (!/[a-z]/.test(password)) problems.push('Password must contain at least one lowercase letter')
    if (!/[A-Z]/.test(password)) problems.push('Password must contain at least one uppercase letter')
    if (!/\d/.test(password)) problems.push('Password must contain at least one digit')
    if (!/[^a-zA-Z0-9]/.test(password)) problems.push('Password must contain at least one special character')
    return problems
}

const saltRounds = (): number => {
    const rounds = parseInt(process.env.PASSWORD_SALT_HASH_ROUNDS || '', 10)
    return Number.isInteger(rounds) && rounds >= 10 && rounds <= 15 ? rounds : 12
}

export const hashPassword = (password: string): Promise<string> => bcrypt.hash(password, saltRounds())

/** Hashes written by Flowise 3.x are bcrypt too, so existing owners keep their password */
export const verifyPassword = async (password: string, hash: string | null | undefined): Promise<boolean> => {
    if (!hash || typeof password !== 'string') return false
    try {
        return await bcrypt.compare(password, hash)
    } catch {
        return false
    }
}

// bcrypt of a random string, used to spend the same time when the email is unknown
let dummyHash: Promise<string> | undefined
export const burnPasswordCheck = async (password: string): Promise<void> => {
    dummyHash ??= bcrypt.hash(`keelflow-${Math.random()}`, saltRounds())
    await verifyPassword(password, await dummyHash)
}

export const isValidEmail = (email: unknown): email is string =>
    typeof email === 'string' && email.length <= 255 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
