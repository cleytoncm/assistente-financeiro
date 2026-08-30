import { Router } from 'express'
import { requireAuth } from '../../middleware/requireAuth.js'
import { create, index, update, updateStatus, remove } from './card.controller.js'
import { listByCard } from '../invoices/invoice.controller.js'

export const cardRouter = Router()

cardRouter.use(requireAuth)
cardRouter.post('/', create)
cardRouter.get('/', index)
cardRouter.get('/:id/invoices', listByCard)
cardRouter.patch('/:id/status', updateStatus)
cardRouter.patch('/:id', update)
cardRouter.delete('/:id', remove)
