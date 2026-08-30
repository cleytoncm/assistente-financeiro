import type { Request, Response } from 'express'
import multer from 'multer'
import { uploadImportBatchSchema } from './importBatch.schemas.js'
import {
  createImportBatch,
  listImportBatches,
  getOwnedImportBatch,
  listImportedRows,
  confirmImportBatch,
} from './importBatch.service.js'
import {
  ImportBatchNotFoundError,
  ImportDestinationNotFoundError,
  ImportDestinationInactiveError,
  DuplicateFileConfirmationRequiredError,
  ImportBatchNotAwaitingReviewError,
  FileTooLargeError,
  InvalidFileExtensionError,
} from './importBatch.errors.js'

export const uploadMiddleware = multer({ storage: multer.memoryStorage() }).single('file')

function handleServiceError(error: unknown, res: Response): void {
  if (error instanceof ImportBatchNotFoundError) {
    res.status(404).json({ error: error.message })
    return
  }
  if (
    error instanceof ImportDestinationNotFoundError ||
    error instanceof FileTooLargeError ||
    error instanceof InvalidFileExtensionError
  ) {
    res.status(400).json({ error: error.message })
    return
  }
  if (error instanceof ImportDestinationInactiveError || error instanceof ImportBatchNotAwaitingReviewError) {
    res.status(409).json({ error: error.message })
    return
  }
  if (error instanceof DuplicateFileConfirmationRequiredError) {
    res.status(409).json({
      error: error.message,
      previousImportBatchId: error.previousImportBatchId,
      previousImportedAt: error.previousImportedAt,
    })
    return
  }
  /* v8 ignore next -- defensive re-throw for unexpected errors, not triggerable in tests */
  throw error
}

export async function create(req: Request, res: Response): Promise<void> {
  if (!req.file) {
    res.status(400).json({ error: 'A file is required' })
    return
  }

  const parsed = uploadImportBatchSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' })
    return
  }

  try {
    const batch = await createImportBatch(req.userId!, parsed.data, {
      buffer: req.file.buffer,
      originalName: req.file.originalname,
    })
    res.status(202).json(batch)
  } catch (error) {
    handleServiceError(error, res)
  }
}

export async function index(req: Request, res: Response): Promise<void> {
  const batches = await listImportBatches(req.userId!)
  res.status(200).json(batches)
}

export async function show(req: Request, res: Response): Promise<void> {
  try {
    const batch = await getOwnedImportBatch(req.userId!, req.params.id as string)
    res.status(200).json(batch)
  } catch (error) {
    handleServiceError(error, res)
  }
}

export async function rows(req: Request, res: Response): Promise<void> {
  try {
    const result = await listImportedRows(req.userId!, req.params.id as string)
    res.status(200).json(result)
  } catch (error) {
    handleServiceError(error, res)
  }
}

export async function confirm(req: Request, res: Response): Promise<void> {
  try {
    const batch = await confirmImportBatch(req.userId!, req.params.id as string)
    res.status(200).json(batch)
  } catch (error) {
    handleServiceError(error, res)
  }
}
