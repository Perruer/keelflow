import { Args } from '@oclif/core'
import { QueryRunner } from 'typeorm'
import * as DataSource from '../DataSource'
import { User } from '../database/entities/User'
import { resetOwnerPassword } from '../identity'
import logger from '../utils/logger'
import { BaseCommand } from './base'

export default class user extends BaseCommand {
    static args = {
        email: Args.string({
            description: 'Email address to search for in the user database'
        }),
        password: Args.string({
            description: 'New password for that user'
        })
    }

    async run(): Promise<void> {
        const { args } = await this.parse(user)

        let queryRunner: QueryRunner | undefined
        try {
            logger.info('Initializing DataSource')
            const dataSource = await DataSource.getDataSource()
            await dataSource.initialize()

            queryRunner = dataSource.createQueryRunner()
            await queryRunner.connect()

            if (args.email && args.password) {
                const updated = await resetOwnerPassword(dataSource, args.email, args.password)
                logger.info(`Password reset for ${updated.email}. All existing sign-ins were ended.`)
            } else {
                logger.info('Running listUserEmails')
                await this.listUserEmails(queryRunner)
            }
        } catch (error) {
            logger.error(error)
        } finally {
            if (queryRunner && !queryRunner.isReleased) await queryRunner.release()
            await this.gracefullyExit()
        }
    }

    async listUserEmails(queryRunner: QueryRunner) {
        logger.info('Listing all user emails')
        const users = await queryRunner.manager.find(User, {
            select: ['email']
        })

        const emails = users.map((user) => user.email)
        logger.info(`Email addresses: ${emails.join(', ')}`)
        logger.info(`Email count: ${emails.length}`)
        logger.info('To reset a password run: pnpm user <email> <new-password>')
    }
}
