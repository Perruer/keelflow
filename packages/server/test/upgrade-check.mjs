/* eslint-disable no-console */
// Checks that a database created by Flowise 3.x works in Keelflow without changes:
// the existing owner signs in with the old password, sees the old flows, and old API keys keep their limits.
// Usage: node test/upgrade-check.mjs <baseUrl> <result.json from make-flowise-db.cjs>
//    or: node test/upgrade-check.mjs <baseUrl> <ownerEmail> <ownerPassword> <apiKey> <flowName>
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const args = process.argv.slice(2)
const fromFile = args[1]?.endsWith('.json') ? JSON.parse(readFileSync(args[1], 'utf8')) : undefined
const base = args[0]
const { email, password, apiKey, flowName } = fromFile ?? { email: args[1], password: args[2], apiKey: args[3], flowName: args[4] }
let cookie = ''

const call = async (method, path, { body, auth, internal = true } = {}) => {
    const headers = { 'content-type': 'application/json' }
    if (internal) headers['x-request-from'] = 'internal'
    if (cookie) headers.cookie = cookie
    if (auth) headers.authorization = `Bearer ${auth}`
    const res = await fetch(base + '/api/v1' + path, { method, headers, body: body ? JSON.stringify(body) : undefined })
    const setCookie = res.headers.get('set-cookie')
    if (setCookie) cookie = setCookie.split(';')[0]
    const text = await res.text()
    try {
        return { status: res.status, data: JSON.parse(text) }
    } catch {
        return { status: res.status, data: text }
    }
}

const checks = [
    [
        'existing owner goes to sign-in, not setup',
        async () => {
            assert.equal((await call('POST', '/auth/resolve', { body: {} })).data.redirectUrl, '/signin')
        }
    ],
    [
        'registration stays closed',
        async () => {
            const r = await call('POST', '/account/register', {
                body: { user: { name: 'x', email: 'x@example.com', credential: 'Keel-flow-2026!' } }
            })
            assert.equal(r.status, 409)
        }
    ],
    [
        'owner signs in with the Flowise password',
        async () => {
            const r = await call('POST', '/auth/login', { body: { email, password } })
            assert.equal(r.status, 200, JSON.stringify(r.data))
            assert.equal(r.data.email, email)
        }
    ],
    [
        'flows created in Flowise are visible',
        async () => {
            const r = await call('GET', '/chatflows?type=CHATFLOW')
            assert.equal(r.status, 200, JSON.stringify(r.data))
            const list = Array.isArray(r.data) ? r.data : r.data.data
            assert.ok(
                list.some((f) => f.name === flowName),
                JSON.stringify(list.map((f) => f.name))
            )
        }
    ],
    [
        'API key from Flowise still works within its permissions',
        async () => {
            const ok = await call('GET', '/chatflows?type=CHATFLOW', { auth: apiKey, internal: false })
            assert.equal(ok.status, 200, JSON.stringify(ok.data))
            cookie = ''
            const denied = await call('GET', '/credentials', { auth: apiKey, internal: false })
            assert.equal(denied.status, 403, JSON.stringify(denied.data))
        }
    ]
]

for (const [name, fn] of checks) {
    try {
        await fn()
        console.log(`ok   ${name}`)
    } catch (error) {
        console.log(`FAIL ${name}\n     ${error.message}`)
        process.exitCode = 1
    }
}
