import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

export const DEFAULT_ORGANIZATION_NAME = 'Default Organization'

/**
 * Keelflow runs a single organization. The table layout matches Flowise 3.x so
 * an existing database keeps working after the switch.
 */
@Entity('organization')
export class Organization {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Column({ type: 'varchar', length: 100, default: DEFAULT_ORGANIZATION_NAME })
    name: string

    @CreateDateColumn()
    createdDate?: Date

    @UpdateDateColumn()
    updatedDate?: Date

    @Column({ nullable: false })
    createdBy: string

    @Column({ nullable: false })
    updatedBy: string
}
