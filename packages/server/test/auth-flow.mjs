/* eslint-disable no-console */
// End-to-end check of Keelflow's owner account, sessions and API keys against a running server.
// Usage: node test/auth-flow.mjs [baseUrl]   (use a fresh database: it registers the owner)
import assert from 'node:assert/strict'

const base = (process.argv[2] || process.env.KEELFLOW_URL || 'http://localhost:3000').replace(/\/$/, '')
const owner = { name: 'Test Owner', email: `owner-${Date.now()}@example.com`, password: 'Keel-flow-2026!' }
let cookie = ''

const call = async (method, path, { body, auth, internal = true, jar = true } = {}) => {
    const headers = { 'content-type': 'application/json' }
    if (internal) headers['x-request-from'] = 'internal'
    if (jar && cookie) headers.cookie = cookie
    if (auth) headers.authorization = `Bearer ${auth}`
    const res = await fetch(base + '/api/v1' + path, { method, headers, body: body ? JSON.stringify(body) : undefined })
    const setCookie = res.headers.get('set-cookie')
    if (jar && setCookie) {
        const pair = setCookie.split(';')[0]
        cookie = pair.endsWith('=') ? '' : pair
    }
    const text = await res.text()
    let data
    try {
        data = JSON.parse(text)
    } catch {
        data = text
    }
    return { status: res.status, data, setCookie }
}

const step = async (name, fn) => {
    try {
        await fn()
        console.log(`ok   ${name}`)
    } catch (error) {
        console.log(`FAIL ${name}\n     ${error.message}`)
        process.exitCode = 1
    }
}

await step('settings report the open source edition', async () => {
    const r = await call('GET', '/settings')
    assert.equal(r.data.PLATFORM_TYPE, 'open source')
})

await step('fresh instance asks for owner setup', async () => {
    const r = await call('POST', '/auth/resolve', { body: {} })
    assert.equal(r.data.redirectUrl, '/organization-setup')
})

await step('internal API calls need a session', async () => {
    const r = await call('GET', '/chatflows', { jar: false })
    assert.equal(r.status, 401)
})

await step('weak passwords are refused', async () => {
    const r = await call('POST', '/account/register', { body: { user: { name: 'x', email: owner.email, credential: 'short' } } })
    assert.equal(r.status, 400, JSON.stringify(r.data))
})

await step('owner account is created', async () => {
    const r = await call('POST', '/account/register', {
        body: { user: { name: owner.name, email: owner.email, credential: owner.password } }
    })
    assert.equal(r.status, 201, JSON.stringify(r.data))
})

await step('registration closes once the owner exists (GHSA-v5w9-prxf-w882)', async () => {
    const r = await call('POST', '/account/register', {
        body: { user: { name: 'Intruder', email: 'intruder@example.com', credential: owner.password } }
    })
    assert.equal(r.status, 409, JSON.stringify(r.data))
})

await step('sign-in page is offered after setup', async () => {
    const r = await call('POST', '/auth/resolve', { body: {} })
    assert.equal(r.data.redirectUrl, '/signin')
})

await step('wrong password is rejected without a session', async () => {
    const r = await call('POST', '/auth/login', { body: { email: owner.email, password: 'Wrong-pass-1!' }, jar: false })
    assert.equal(r.status, 401)
    assert.equal(r.setCookie, null)
})

await step('owner signs in and gets an httpOnly session cookie', async () => {
    const r = await call('POST', '/auth/login', { body: { email: owner.email.toUpperCase(), password: owner.password } })
    assert.equal(r.status, 200, JSON.stringify(r.data))
    assert.match(r.setCookie, /keelflow_session=.+HttpOnly/i)
    assert.equal(r.data.email, owner.email)
    assert.equal(r.data.isOrganizationAdmin, true)
    assert.ok(r.data.activeWorkspaceId)
    assert.equal(r.data.features['feat:evaluations'], 'true')
})

await step('session works for the web UI', async () => {
    const r = await call('GET', '/chatflows')
    assert.equal(r.status, 200, JSON.stringify(r.data))
})

await step('refreshToken confirms the session', async () => {
    const r = await call('POST', '/auth/refreshToken', { body: {} })
    assert.equal(r.status, 200)
    assert.equal(r.data.email, owner.email)
})

await step('profile can be read', async () => {
    const r = await call('GET', '/user')
    assert.equal(r.status, 200)
    assert.equal(r.data.email, owner.email)
    assert.equal(r.data.credential, undefined)
})

let apiKey = ''
await step('API key permission catalog is available', async () => {
    const r = await call('GET', '/auth/permissions/API_KEY')
    assert.equal(r.status, 200)
    assert.ok(r.data.chatflows.some((p) => p.key === 'chatflows:view' && p.isOpenSource))
})

await step('owner creates a read-only API key', async () => {
    const r = await call('POST', '/apikey', { body: { keyName: 'read-only', permissions: ['chatflows:view'] } })
    assert.equal(r.status, 200, JSON.stringify(r.data))
    const key = (Array.isArray(r.data) ? r.data : r.data.data).find((k) => k.keyName === 'read-only')
    apiKey = key.apiKey
    assert.ok(apiKey)
})

await step('API key can do what it was granted', async () => {
    const r = await call('GET', '/chatflows', { auth: apiKey, internal: false, jar: false })
    assert.equal(r.status, 200, JSON.stringify(r.data))
})

await step('API key cannot do more than it was granted', async () => {
    const r = await call('GET', '/credentials', { auth: apiKey, internal: false, jar: false })
    assert.equal(r.status, 403, JSON.stringify(r.data))
})

await step('API key cannot reach account endpoints', async () => {
    const r = await call('GET', '/user', { auth: apiKey, internal: false, jar: false })
    assert.equal(r.status, 401)
})

await step('unknown API key is rejected', async () => {
    const r = await call('GET', '/chatflows', { auth: 'not-a-key', internal: false, jar: false })
    assert.equal(r.status, 401)
})

const newPassword = 'Keel-flow-2027?'
await step('password change needs the current password', async () => {
    const r = await call('PUT', '/user', { body: { oldPassword: 'nope', newPassword, confirmPassword: newPassword } })
    assert.equal(r.status, 400)
})

let oldCookie = ''
await step('password change ends every session', async () => {
    oldCookie = cookie
    const r = await call('PUT', '/user', { body: { oldPassword: owner.password, newPassword, confirmPassword: newPassword } })
    assert.equal(r.status, 200, JSON.stringify(r.data))
    cookie = oldCookie
    const after = await call('GET', '/chatflows')
    assert.equal(after.status, 401)
})

await step('new password signs in, logout ends the session', async () => {
    const r = await call('POST', '/auth/login', { body: { email: owner.email, password: newPassword } })
    assert.equal(r.status, 200)
    const signedIn = cookie
    await call('POST', '/account/logout', { body: {} })
    cookie = signedIn
    const after = await call('GET', '/chatflows')
    assert.equal(after.status, 401)
})

await step('repeated failures are throttled', async () => {
    let last
    for (let i = 0; i < 11; i++) {
        last = await call('POST', '/auth/login', { body: { email: 'nobody@example.com', password: `Wrong-${i}-pass!` }, jar: false })
    }
    assert.equal(last.status, 429)
})

console.log(process.exitCode ? 'some checks failed' : 'all checks passed')
