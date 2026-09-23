import express from 'express'
import toolsController from '../../controllers/tools'
import { checkAnyPermission, checkPermission } from '../../identity'

const router = express.Router()

// CREATE
router.post('/', checkPermission('tools:create'), toolsController.createTool)

// READ
router.get('/', checkPermission('tools:view'), toolsController.getAllTools)
router.get(['/', '/:id'], checkAnyPermission('tools:view'), toolsController.getToolById)

// UPDATE
router.put(['/', '/:id'], checkAnyPermission('tools:update,tools:create'), toolsController.updateTool)

// DELETE
router.delete(['/', '/:id'], checkPermission('tools:delete'), toolsController.deleteTool)

export default router
