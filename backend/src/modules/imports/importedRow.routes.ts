import { Router } from 'express'
import { requireAuth } from '../../middleware/requireAuth.js'
import { update, discard } from './importedRow.controller.js'

export const importedRowRouter = Router()

importedRowRouter.use(requireAuth)
importedRowRouter.patch('/:id', update)
importedRowRouter.post('/:id/discard', discard)
