import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

export enum UserStatus {
    ACTIVE = 'active',
    INVITED = 'invited',
    UNVERIFIED = 'unverified',
    DELETED = 'deleted'
}

@Entity('user')
export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Column({ type: 'varchar', length: 100 })
    name: string

    @Column({ type: 'varchar', length: 255, unique: true })
    email: string

    /** bcrypt hash of the password */
    @Column({ type: 'text', nullable: true })
    credential?: string | null

    /** Unused by Keelflow (Flowise stored invite and reset tokens here); kept so the columns map */
    @Column({ type: 'text', nullable: true, unique: true })
    tempToken?: string | null

    @Column({ type: Date, nullable: true })
    tokenExpiry?: Date | null

    @Column({ type: 'varchar', length: 20, default: UserStatus.ACTIVE })
    status: string

    @CreateDateColumn()
    createdDate?: Date

    @UpdateDateColumn()
    updatedDate?: Date

    @Column({ nullable: false })
    createdBy: string

    @Column({ nullable: false })
    updatedBy: string
}
