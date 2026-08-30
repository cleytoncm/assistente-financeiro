import { Router } from 'express'
import { requireAuth } from '../../middleware/requireAuth.js'
import { index, create } from './bank.controller.js'

export const bankRouter = Router()

bankRouter.use(requireAuth)
bankRouter.get('/', index)
bankRouter.post('/', create)
