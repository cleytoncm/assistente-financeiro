import { Router } from 'express'
import { requireAuth } from '../../middleware/requireAuth.js'
import { create, index, show, update, pay, cancel, remove, summary } from './payable.controller.js'

export const payableRouter = Router()

payableRouter.use(requireAuth)
payableRouter.post('/', create)
payableRouter.get('/', index)
payableRouter.get('/summary', summary)
payableRouter.get('/:id', show)
payableRouter.patch('/:id', update)
payableRouter.delete('/:id', remove)
payableRouter.post('/:id/pay', pay)
payableRouter.post('/:id/cancel', cancel)
