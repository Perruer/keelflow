import express from 'express'
import nodesRouter from '../../controllers/nodes'
import { checkAnyPermission } from '../../identity'

const router = express.Router()

router.post(
    ['/', '/:name'],
    checkAnyPermission(
        'chatflows:view,chatflows:create,chatflows:update,chatflows:delete,agentflows:view,agentflows:create,agentflows:update,agentflows:delete,documentStores:view,documentStores:create,documentStores:update,documentStores:add-loader'
    ),
    nodesRouter.getSingleNodeAsyncOptions
)

export default router
