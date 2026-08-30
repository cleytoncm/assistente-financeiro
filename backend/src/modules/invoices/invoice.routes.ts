import { Router } from 'express'
import { requireAuth } from '../../middleware/requireAuth.js'
import { show, transactions, update, pay } from './invoice.controller.js'

export const invoiceRouter = Router()

invoiceRouter.use(requireAuth)
invoiceRouter.get('/:id', show)
invoiceRouter.get('/:id/transactions', transactions)
invoiceRouter.patch('/:id', update)
invoiceRouter.post('/:id/pay', pay)
