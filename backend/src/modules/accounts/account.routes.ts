import { Router } from 'express'
import { requireAuth } from '../../middleware/requireAuth.js'
import { create, index, update, updateStatus, remove } from './account.controller.js'

export const accountRouter = Router()

accountRouter.use(requireAuth)
accountRouter.post('/', create)
accountRouter.get('/', index)
accountRouter.patch('/:id/status', updateStatus)
accountRouter.patch('/:id', update)
accountRouter.delete('/:id', remove)
