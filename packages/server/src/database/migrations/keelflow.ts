import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm'

/**
 * Keelflow's own schema for accounts and workspaces, shared by every database type.
 *
 * Databases upgraded from Flowise 3.x already have these tables and columns, so each
 * step checks first and does nothing when the object exists. Fresh databases and ones
 * coming from Flowise 2.x get them created here, at the same point in the migration
 * order where Flowise created them.
 */

type Dialect = 'sqlite' | 'postgres' | 'mysql'

const dialectOf = (queryRunner: QueryRunner): Dialect => {
    const type = queryRunner.connection.options.type
    if (type === 'postgres') return 'postgres'
    if (type === 'mysql' || type === 'mariadb') return 'mysql'
    return 'sqlite'
}

const q = (queryRunner: QueryRunner, name: string) => queryRunner.connection.driver.escape(name)

const idColumn = (d: Dialect) =>
    d === 'postgres'
        ? 'uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY'
        : d === 'mysql'
        ? 'varchar(36) NOT NULL PRIMARY KEY'
        : 'varchar PRIMARY KEY NOT NULL'

const refColumn = (d: Dialect, nullable = false) =>
    `${d === 'postgres' ? 'uuid' : d === 'mysql' ? 'varchar(36)' : 'varchar'} ${nullable ? 'NULL' : 'NOT NULL'}`

const dateColumn = (d: Dialect) =>
    d === 'postgres'
        ? 'timestamp NOT NULL DEFAULT now()'
        : d === 'mysql'
        ? 'datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)'
        : "datetime NOT NULL DEFAULT (datetime('now'))"

const tableSuffix = (d: Dialect) => (d === 'mysql' ? ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4' : '')

const createTable = async (queryRunner: QueryRunner, name: string, columns: [string, string][]) => {
    if (await queryRunner.hasTable(name)) return
    const d = dialectOf(queryRunner)
    const body = columns.map(([column, definition]) => `${q(queryRunner, column)} ${definition}`).join(',\n    ')
    await queryRunner.query(`CREATE TABLE ${q(queryRunner, name)} (\n    ${body}\n)${tableSuffix(d)};`)
}

const addWorkspaceColumn = async (queryRunner: QueryRunner, table: string) => {
    if (!(await queryRunner.hasTable(table))) return
    const d = dialectOf(queryRunner)
    if (!(await queryRunner.hasColumn(table, 'workspaceId'))) {
        await queryRunner.addColumn(
            table,
            new TableColumn({
                name: 'workspaceId',
                type: d === 'postgres' ? 'uuid' : d === 'mysql' ? 'varchar' : 'text',
                length: d === 'mysql' ? '36' : undefined,
                isNullable: true
            })
        )
    }
    const existing = await queryRunner.getTable(table)
    const indexName = `idx_${table}_workspaceId`
    if (existing && !existing.indices.some((index) => index.columnNames.length === 1 && index.columnNames[0] === 'workspaceId')) {
        await queryRunner.createIndex(table, new TableIndex({ name: indexName, columnNames: ['workspaceId'] }))
    }
}

const identityColumns = (d: Dialect): Record<string, [string, string][]> => ({
    user: [
        ['id', idColumn(d)],
        ['name', 'varchar(100) NOT NULL'],
        ['email', 'varchar(255) NOT NULL UNIQUE'],
        ['credential', 'text NULL'],
        ['tempToken', 'text NULL'],
        ['tokenExpiry', d === 'postgres' ? 'timestamp NULL' : d === 'mysql' ? 'datetime(6) NULL' : 'datetime NULL'],
        ['status', "varchar(20) NOT NULL DEFAULT 'active'"],
        ['createdDate', dateColumn(d)],
        ['updatedDate', dateColumn(d)],
        ['createdBy', refColumn(d)],
        ['updatedBy', refColumn(d)]
    ],
    organization: [
        ['id', idColumn(d)],
        ['name', "varchar(100) NOT NULL DEFAULT 'Default Organization'"],
        ['customerId', 'varchar(100) NULL'],
        ['subscriptionId', 'varchar(100) NULL'],
        ['createdDate', dateColumn(d)],
        ['updatedDate', dateColumn(d)],
        ['createdBy', refColumn(d)],
        ['updatedBy', refColumn(d)]
    ],
    workspace: [
        ['id', idColumn(d)],
        ['name', "varchar(100) NOT NULL DEFAULT 'Default Workspace'"],
        ['description', 'text NULL'],
        ['organizationId', refColumn(d)],
        ['createdDate', dateColumn(d)],
        ['updatedDate', dateColumn(d)],
        ['createdBy', refColumn(d)],
        ['updatedBy', refColumn(d)]
    ]
})

// Tables that existed before workspaces were introduced
const EARLY_WORKSPACE_TABLES = [
    'chat_flow',
    'tool',
    'assistant',
    'credential',
    'document_store',
    'evaluation',
    'evaluator',
    'dataset',
    'apikey',
    'variable'
]

export class KeelflowIdentityTables1720230151483 implements MigrationInterface {
    name = 'KeelflowIdentityTables1720230151483'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const d = dialectOf(queryRunner)
        for (const [table, columns] of Object.entries(identityColumns(d))) {
            await createTable(queryRunner, table, columns)
        }
        for (const table of EARLY_WORKSPACE_TABLES) {
            await addWorkspaceColumn(queryRunner, table)
        }
    }

    // Accounts and workspace links hold user data; they are not dropped on revert
    public async down(): Promise<void> {}
}

export class KeelflowWorkspaceColumns1738090872626 implements MigrationInterface {
    name = 'KeelflowWorkspaceColumns1738090872626'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await addWorkspaceColumn(queryRunner, 'custom_template')
        await addWorkspaceColumn(queryRunner, 'execution')
    }

    public async down(): Promise<void> {}
}

export class KeelflowAuthSession1790000000000 implements MigrationInterface {
    name = 'KeelflowAuthSession1790000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const d = dialectOf(queryRunner)
        const date = d === 'postgres' ? 'timestamp NOT NULL' : d === 'mysql' ? 'datetime(6) NOT NULL' : 'datetime NOT NULL'
        await createTable(queryRunner, 'auth_session', [
            ['id', d === 'sqlite' ? 'varchar(64) PRIMARY KEY NOT NULL' : 'varchar(64) NOT NULL PRIMARY KEY'],
            ['userId', 'varchar(36) NOT NULL'],
            ['createdDate', dateColumn(d)],
            ['expiresAt', date],
            ['lastUsedDate', date],
            ['userAgent', 'varchar(255) NULL'],
            ['ip', 'varchar(64) NULL']
        ])
        const table = await queryRunner.getTable('auth_session')
        if (table && !table.indices.some((index) => index.columnNames.includes('userId'))) {
            await queryRunner.createIndex('auth_session', new TableIndex({ name: 'idx_auth_session_userId', columnNames: ['userId'] }))
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('auth_session', true)
    }
}
