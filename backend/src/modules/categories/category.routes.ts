import { Router } from 'express'
import { requireAuth } from '../../middleware/requireAuth.js'
import { index, create } from './category.controller.js'

export const categoryRouter = Router()

categoryRouter.use(requireAuth)
categoryRouter.get('/', index)
categoryRouter.post('/', create)
