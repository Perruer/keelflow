import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

export const DEFAULT_WORKSPACE_NAME = 'Default Workspace'

@Entity('workspace')
export class Workspace {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Column({ type: 'varchar', length: 100, default: DEFAULT_WORKSPACE_NAME })
    name: string

    @Column({ type: 'text', nullable: true })
    description?: string

    @Column({ nullable: false })
    organizationId: string

    @CreateDateColumn()
    createdDate?: Date

    @UpdateDateColumn()
    updatedDate?: Date

    @Column({ nullable: false })
    createdBy: string

    @Column({ nullable: false })
    updatedBy: string
}
