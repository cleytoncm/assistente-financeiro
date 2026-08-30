import { Router } from 'express'
import { requireAuth } from '../../middleware/requireAuth.js'
import { create, index, update, remove } from './card.controller.js'

export const cardRouter = Router()

cardRouter.use(requireAuth)
cardRouter.post('/', create)
cardRouter.get('/', index)
cardRouter.patch('/:id', update)
cardRouter.delete('/:id', remove)
