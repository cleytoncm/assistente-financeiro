import { Router } from 'express'
import { requireAuth } from '../../middleware/requireAuth.js'
import { create, index, update, remove } from './transaction.controller.js'

export const transactionRouter = Router()

transactionRouter.use(requireAuth)
transactionRouter.post('/', create)
transactionRouter.get('/', index)
transactionRouter.patch('/:id', update)
transactionRouter.delete('/:id', remove)
