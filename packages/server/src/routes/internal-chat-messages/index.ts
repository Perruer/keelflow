import express from 'express'
import chatMessagesController from '../../controllers/chat-messages'
import { checkAnyPermission } from '../../identity'
const router = express.Router()

// CREATE

// READ
router.get(
    ['/', '/:id'],
    checkAnyPermission('chatflows:view,chatflows:update,agentflows:view,agentflows:update'),
    chatMessagesController.getAllInternalChatMessages
)

// UPDATE

// DELETE

export default router
