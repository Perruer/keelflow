import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm'

/**
 * A browser sign-in. The cookie carries a random token; only its SHA-256 is stored,
 * so a leaked database does not hand out working sessions.
 */
@Entity('auth_session')
export class AuthSession {
    @PrimaryColumn({ type: 'varchar', length: 64 })
    id: string

    @Index()
    @Column({ type: 'varchar', length: 36 })
    userId: string

    @CreateDateColumn()
    createdDate: Date

    @Column()
    expiresAt: Date

    @Column()
    lastUsedDate: Date

    @Column({ type: 'varchar', length: 255, nullable: true })
    userAgent?: string | null

    @Column({ type: 'varchar', length: 64, nullable: true })
    ip?: string | null
}
