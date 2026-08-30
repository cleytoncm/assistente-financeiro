import { Router } from 'express'
import { requireAuth } from '../../middleware/requireAuth.js'
import { uploadMiddleware, create, index, show, rows, confirm } from './importBatch.controller.js'

export const importBatchRouter = Router()

importBatchRouter.use(requireAuth)
importBatchRouter.post('/', uploadMiddleware, create)
importBatchRouter.get('/', index)
importBatchRouter.get('/:id', show)
importBatchRouter.get('/:id/rows', rows)
importBatchRouter.post('/:id/confirm', confirm)
