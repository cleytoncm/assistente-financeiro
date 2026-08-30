import { Router } from 'express'
import { requireAuth } from '../../middleware/requireAuth.js'
import { create, index, show, update, remove } from './payableGroup.controller.js'

export const payableGroupRouter = Router()

payableGroupRouter.use(requireAuth)
payableGroupRouter.post('/', create)
payableGroupRouter.get('/', index)
payableGroupRouter.get('/:id', show)
payableGroupRouter.patch('/:id', update)
payableGroupRouter.delete('/:id', remove)
