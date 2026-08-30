import { apiFetch } from '../lib/httpClient'

export type ImportFormat = 'ofx' | 'csv' | 'pdf_invoice'
export type ImportMode = 'staged' | 'direct'
export type ImportBatchStatus = 'processando' | 'aguardando_revisao' | 'concluido' | 'falhou'
export type ImportedRowResolution = 'pendente' | 'aceita' | 'descartada'

export type ImportBatch = {
  id: string
  format: ImportFormat
  accountId: string | null
  cardId: string | null
  mode: ImportMode
  status: ImportBatchStatus
  errorMessage: string | null
  createdAt: string
  processedAt: string | null
}

export type ImportedRow = {
  id: string
  importBatchId: string
  date: string
  description: string
  amount: string
  type: 'income' | 'expense'
  externalId: string | null
  isDuplicateSuspect: boolean
  duplicateOfTransactionId: string | null
  suggestedCategoryId: string | null
  resolution: ImportedRowResolution
  createdTransactionId: string | null
}

export async function createImportBatch(data: {
  file: File
  format: ImportFormat
  accountId?: string
  cardId?: string
  mode: ImportMode
  confirmDuplicateFile?: boolean
}): Promise<ImportBatch> {
  const body = new FormData()
  // Rebuilds the File as a Blob from its raw bytes using the ambient Blob constructor, rather
  // than appending `data.file` directly: a File coming from an <input> element isn't always
  // recognized as "real" Blob data by FormData/fetch's own internals (this bit jsdom + userEvent
  // specifically, where the resulting file silently degraded to a plain string field).
  const bytes = await data.file.arrayBuffer()
  body.set('file', new Blob([bytes], { type: data.file.type }), data.file.name)
  body.set('format', data.format)
  body.set('mode', data.mode)
  if (data.accountId) body.set('accountId', data.accountId)
  if (data.cardId) body.set('cardId', data.cardId)
  if (data.confirmDuplicateFile !== undefined) body.set('confirmDuplicateFile', String(data.confirmDuplicateFile))
  return apiFetch<ImportBatch>('/import-batches', { method: 'POST', body })
}

export function listImportBatches(): Promise<ImportBatch[]> {
  return apiFetch<ImportBatch[]>('/import-batches')
}

export function getImportBatch(id: string): Promise<ImportBatch> {
  return apiFetch<ImportBatch>(`/import-batches/${id}`)
}

export function listImportedRows(importBatchId: string): Promise<ImportedRow[]> {
  return apiFetch<ImportedRow[]>(`/import-batches/${importBatchId}/rows`)
}

export function confirmImportBatch(id: string): Promise<ImportBatch> {
  return apiFetch<ImportBatch>(`/import-batches/${id}/confirm`, { method: 'POST' })
}

export function updateImportedRow(
  id: string,
  data: {
    date?: string
    description?: string
    amount?: number
    type?: 'income' | 'expense'
    categoryId?: string | null
  }
): Promise<ImportedRow> {
  return apiFetch<ImportedRow>(`/imported-rows/${id}`, { method: 'PATCH', body: data })
}

export function discardImportedRow(id: string): Promise<ImportedRow> {
  return apiFetch<ImportedRow>(`/imported-rows/${id}/discard`, { method: 'POST' })
}
