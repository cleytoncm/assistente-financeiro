import { Router } from 'express'
import { process } from './internalImport.controller.js'

export const internalImportRouter = Router()

internalImportRouter.post('/:id/process', process)
