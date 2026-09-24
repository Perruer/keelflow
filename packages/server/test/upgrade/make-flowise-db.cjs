// Builds a SQLite database the way Flowise 3.1.4 leaves it after owner setup, so Keelflow's
// upgrade path can be tested against real upstream migrations.
// Usage: FLOWISE_PACKAGE_DIR=<unpacked flowise-3.1.4.tgz>/package NODE_PATH=packages/server/node_modules
//        node make-flowise-db.cjs <dbDir> <out.json>
// The owner is owner@flowise.test / Flowise-owner-1!; out.json receives the API key and flow name.
/* eslint-disable no-console */
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const Module = require('module')

// Flowise's compiled migrations require 'flowise-components'; Keelflow ships it as 'keelflow-components'
const resolveFilename = Module._resolveFilename
Module._resolveFilename = function (request, ...rest) {
    return resolveFilename.call(this, request === 'flowise-components' ? 'keelflow-components' : request, ...rest)
}
const { DataSource } = require('typeorm')
const bcrypt = require('bcryptjs')

const dbDir = process.argv[2]
fs.mkdirSync(dbDir, { recursive: true })
const dbFile = path.join(dbDir, 'database.sqlite')
if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile)

const { sqliteMigrations } = require(path.join(process.env.FLOWISE_PACKAGE_DIR || './package', 'dist/database/migrations/sqlite'))

;(async () => {
    const ds = new DataSource({ type: 'sqlite', database: dbFile, synchronize: false, migrationsRun: false, entities: [], migrations: sqliteMigrations })
    await ds.initialize()
    await ds.runMigrations({ transaction: 'each' })
    const q = (sql, params = []) => ds.query(sql, params)

    const roles = await q(`select "id", "name" from "role" where "organizationId" is null`)
    const owner = roles.find((r) => r.name === 'owner')
    if (!owner) throw new Error('owner role missing: ' + JSON.stringify(roles))

    const userId = crypto.randomUUID()
    const orgId = crypto.randomUUID()
    const wsId = crypto.randomUUID()
    const hash = bcrypt.hashSync('Flowise-owner-1!', 10)
    await q(`insert into "user" ("id","name","email","credential","status","createdBy","updatedBy") values (?,?,?,?,?,?,?)`, [
        userId, 'Flowise Owner', 'owner@flowise.test', hash, 'active', userId, userId
    ])
    await q(`insert into "organization" ("id","name","createdBy","updatedBy") values (?,?,?,?)`, [orgId, 'Default Organization', userId, userId])
    await q(`insert into "organization_user" ("organizationId","userId","roleId","status","createdBy","updatedBy") values (?,?,?,?,?,?)`, [
        orgId, userId, owner.id, 'active', userId, userId
    ])
    await q(`insert into "workspace" ("id","name","organizationId","createdBy","updatedBy") values (?,?,?,?,?)`, [wsId, 'Default Workspace', orgId, userId, userId])
    await q(`insert into "workspace_user" ("workspaceId","userId","roleId","status","createdBy","updatedBy") values (?,?,?,?,?,?)`, [
        wsId, userId, owner.id, 'active', userId, userId
    ])
    const flowId = crypto.randomUUID()
    await q(`insert into "chat_flow" ("id","name","flowData","deployed","isPublic","type","workspaceId") values (?,?,?,?,?,?,?)`, [
        flowId, 'Flow from Flowise 3.1.4', JSON.stringify({ nodes: [], edges: [] }), 0, 0, 'CHATFLOW', wsId
    ])
    // an API key created in Flowise, limited to viewing flows
    const apiKey = crypto.randomBytes(32).toString('base64url')
    const salt = crypto.randomBytes(8).toString('hex')
    const buffer = crypto.scryptSync(apiKey, salt, 64)
    await q(`insert into "apikey" ("id","apiKey","apiSecret","keyName","permissions","workspaceId") values (?,?,?,?,?,?)`, [
        crypto.randomUUID().slice(0, 20), apiKey, `${buffer.toString('hex')}.${salt}`, 'from-flowise', JSON.stringify(['chatflows:view']), wsId
    ])
    const executed = await q(`select count(*) as n from "migrations"`)
    const result = { dbFile, migrations: executed[0].n, email: 'owner@flowise.test', password: 'Flowise-owner-1!', apiKey, flowName: 'Flow from Flowise 3.1.4' }
    if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(result, null, 2))
    console.log(JSON.stringify(result))
    await ds.destroy()
})().catch((e) => {
    console.error(e)
    process.exit(1)
})
