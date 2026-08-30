import type { ImportedRow } from '@prisma/client'
import { prisma } from '../../config/prisma.js'
import { parseDateOnly } from '../../lib/dateOnly.js'
import { ImportedRowNotFoundError, ImportedRowNotPendingError } from './importBatch.errors.js'

export async function getOwnedImportedRow(userId: string, id: string): Promise<ImportedRow> {
  const row = await prisma.importedRow.findFirst({
    where: { id, importBatch: { userId } },
  })
  if (!row) throw new ImportedRowNotFoundError()
  return row
}

function assertPending(row: ImportedRow): void {
  if (row.resolution !== 'pendente') throw new ImportedRowNotPendingError()
}

export type UpdateImportedRowParams = {
  date?: string
  description?: string
  amount?: number
  type?: 'income' | 'expense'
  categoryId?: string | null
}

/** RF-06: edits a pending row before it's accepted — including correcting a wrong income/expense classification. */
export async function updateImportedRow(
  userId: string,
  id: string,
  params: UpdateImportedRowParams
): Promise<ImportedRow> {
  const existing = await getOwnedImportedRow(userId, id)
  assertPending(existing)

  return prisma.importedRow.update({
    where: { id },
    data: {
      ...(params.date !== undefined ? { date: parseDateOnly(params.date) } : {}),
      ...(params.description !== undefined ? { description: params.description } : {}),
      ...(params.amount !== undefined ? { amount: params.amount } : {}),
      ...(params.type !== undefined ? { type: params.type } : {}),
      ...(params.categoryId !== undefined ? { suggestedCategoryId: params.categoryId } : {}),
    },
  })
}

export async function discardImportedRow(userId: string, id: string): Promise<ImportedRow> {
  const existing = await getOwnedImportedRow(userId, id)
  assertPending(existing)

  return prisma.importedRow.update({ where: { id }, data: { resolution: 'descartada' } })
}
