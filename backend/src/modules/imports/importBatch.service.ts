import { createHash } from 'node:crypto'
import type { ImportBatch, ImportedRow, ImportFormat, ImportMode } from '@prisma/client'
import { prisma } from '../../config/prisma.js'
import { scopedToUser } from '../../lib/scopedToUser.js'
import { getImportQueue } from './importQueue.js'
import { createTransactionFromRow } from './importProcessor.js'
import {
  ImportBatchNotFoundError,
  ImportDestinationNotFoundError,
  ImportDestinationInactiveError,
  DuplicateFileConfirmationRequiredError,
  ImportBatchNotAwaitingReviewError,
  FileTooLargeError,
  InvalidFileExtensionError,
} from './importBatch.errors.js'

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024

const FORMAT_EXTENSIONS: Record<ImportFormat, string> = {
  ofx: '.ofx',
  csv: '.csv',
  pdf_invoice: '.pdf',
}

async function assertDestinationOwnedAndActive(
  userId: string,
  destination: { accountId?: string; cardId?: string }
): Promise<void> {
  if (destination.accountId) {
    const account = await prisma.account.findFirst(scopedToUser(userId, { where: { id: destination.accountId } }))
    if (!account) throw new ImportDestinationNotFoundError()
    if (!account.isActive) throw new ImportDestinationInactiveError()
    return
  }

  const card = await prisma.card.findFirst(scopedToUser(userId, { where: { id: destination.cardId! } }))
  if (!card) throw new ImportDestinationNotFoundError()
  if (!card.isActive) throw new ImportDestinationInactiveError()
}

export type CreateImportBatchParams = {
  format: ImportFormat
  accountId?: string
  cardId?: string
  mode: ImportMode
  confirmDuplicateFile?: boolean
}

export type UploadedFile = { buffer: Buffer; originalName: string }

export async function createImportBatch(
  userId: string,
  params: CreateImportBatchParams,
  file: UploadedFile
): Promise<ImportBatch> {
  if (file.buffer.byteLength > MAX_FILE_SIZE_BYTES) throw new FileTooLargeError()

  const expectedExtension = FORMAT_EXTENSIONS[params.format]
  if (!file.originalName.toLowerCase().endsWith(expectedExtension)) {
    throw new InvalidFileExtensionError(expectedExtension)
  }

  await assertDestinationOwnedAndActive(userId, params)

  const fileHash = createHash('sha256').update(file.buffer).digest('hex')

  if (!params.confirmDuplicateFile) {
    const previous = await prisma.importBatch.findFirst({
      where: { userId, fileHash, status: 'concluido' },
      orderBy: { processedAt: 'desc' },
    })
    if (previous?.processedAt) {
      throw new DuplicateFileConfirmationRequiredError(previous.id, previous.processedAt)
    }
  }

  const batch = await prisma.importBatch.create({
    data: {
      userId,
      format: params.format,
      accountId: params.accountId ?? null,
      cardId: params.cardId ?? null,
      mode: params.mode,
      status: 'processando',
      fileHash,
      rawContent: file.buffer,
    },
  })

  getImportQueue().enqueueProcessing(batch.id)

  return batch
}

export async function listImportBatches(userId: string): Promise<ImportBatch[]> {
  return prisma.importBatch.findMany(
    scopedToUser(userId, { where: {}, orderBy: { createdAt: 'desc' as const } })
  )
}

export async function getOwnedImportBatch(userId: string, id: string): Promise<ImportBatch> {
  const batch = await prisma.importBatch.findFirst(scopedToUser(userId, { where: { id } }))
  if (!batch) throw new ImportBatchNotFoundError()
  return batch
}

export async function listImportedRows(userId: string, importBatchId: string): Promise<ImportedRow[]> {
  await getOwnedImportBatch(userId, importBatchId)
  return prisma.importedRow.findMany({
    where: { importBatchId },
    orderBy: { createdAt: 'asc' },
  })
}

/** RF-06: creates a Transaction for every still-pending row, using its current (edited or not) values. */
export async function confirmImportBatch(userId: string, id: string): Promise<ImportBatch> {
  const batch = await getOwnedImportBatch(userId, id)
  if (batch.status !== 'aguardando_revisao') throw new ImportBatchNotAwaitingReviewError()

  await prisma.$transaction(async (tx) => {
    const pendingRows = await tx.importedRow.findMany({ where: { importBatchId: id, resolution: 'pendente' } })

    for (const row of pendingRows) {
      const transaction = await createTransactionFromRow(tx, batch, row, row.suggestedCategoryId)
      await tx.importedRow.update({
        where: { id: row.id },
        data: { resolution: 'aceita', createdTransactionId: transaction.id },
      })
    }

    await tx.importBatch.update({ where: { id }, data: { status: 'concluido', processedAt: new Date() } })
  })

  return prisma.importBatch.findUniqueOrThrow({ where: { id } })
}
