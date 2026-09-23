import express from 'express'
import logController from '../../controllers/log'
import { checkAnyPermission } from '../../identity'
const router = express.Router()

// READ
router.get('/', checkAnyPermission('logs:view'), logController.getLogs)

export default router
