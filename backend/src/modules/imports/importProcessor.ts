import type { ImportBatch, Prisma, TransactionType } from '@prisma/client'
import { prisma } from '../../config/prisma.js'
import { parseOfx } from './ofxParser.js'
import { getLlmExtractor } from './llmExtractor.js'
import { normalizeDescription } from './normalizeDescription.js'
import { ExtractionError, type ExtractedRow } from './extraction.types.js'
import { resolveInvoiceForDate, syncPaymentTransactionAmount } from '../invoices/invoice.service.js'

type Destination = { accountId: string | null; cardId: string | null }
type DuplicateResult = { kind: 'none' } | { kind: 'exact' } | { kind: 'suspect'; transactionId: string }

async function extractRows(batch: ImportBatch, rawContent: Buffer): Promise<ExtractedRow[]> {
  if (batch.format === 'ofx') return parseOfx(rawContent.toString('utf-8'))
  const extractor = getLlmExtractor()
  return batch.format === 'csv'
    ? extractor.extractFromCsv(rawContent.toString('utf-8'))
    : extractor.extractFromPdf(rawContent)
}

/** RF-04: exact duplicates (same external_id/FITID) are silently dropped; same date+amount+type
 * without an external_id is only a suspect, always routed to review. */
async function detectDuplicate(
  tx: Prisma.TransactionClient,
  userId: string,
  destination: Destination,
  row: ExtractedRow
): Promise<DuplicateResult> {
  if (row.externalId) {
    const exact = await tx.transaction.findFirst({
      where: { userId, ...destination, externalId: row.externalId },
    })
    if (exact) return { kind: 'exact' }
  }

  const suspect = await tx.transaction.findFirst({
    where: { userId, ...destination, date: row.date, amount: row.amount, type: row.type },
  })
  return suspect ? { kind: 'suspect', transactionId: suspect.id } : { kind: 'none' }
}

/**
 * RF-05: suggests the category last used for an exact (normalized) description match. Fetches
 * the user's categorized transactions once per batch rather than once per row.
 */
async function loadCategorySuggester(
  tx: Prisma.TransactionClient,
  userId: string
): Promise<(description: string) => string | null> {
  const candidates = await tx.transaction.findMany({
    where: { userId, categoryId: { not: null } },
    orderBy: { date: 'desc' },
    select: { description: true, categoryId: true },
  })
  return (description: string) => {
    const normalized = normalizeDescription(description)
    return candidates.find((c) => normalizeDescription(c.description) === normalized)?.categoryId ?? null
  }
}

export type RowLike = {
  date: Date
  description: string
  amount: Prisma.Decimal.Value
  type: TransactionType
  externalId?: string | null
}

/**
 * Creates the real Transaction for an imported row (used by direct-mode auto-accept and by
 * batch confirmation alike). A card destination goes through the same invoice_id resolution as
 * any other card transaction (Etapa 4) — but not its payment-adjustment confirmation dialog,
 * which doesn't make sense mid-import; the paid invoice's payment transaction is still kept in
 * sync so its total stays correct.
 */
export async function createTransactionFromRow(
  tx: Prisma.TransactionClient,
  batch: Pick<ImportBatch, 'id' | 'userId' | 'accountId' | 'cardId'>,
  row: RowLike,
  categoryId: string | null
) {
  let invoiceId: string | null = null
  if (batch.cardId) {
    const invoice = await resolveInvoiceForDate(batch.userId, batch.cardId, row.date)
    invoiceId = invoice.id
  }

  const transaction = await tx.transaction.create({
    data: {
      userId: batch.userId,
      type: row.type,
      amount: row.amount,
      date: row.date,
      description: row.description,
      categoryId,
      accountId: batch.accountId,
      cardId: batch.cardId,
      invoiceId,
      externalId: row.externalId ?? null,
      importBatchId: batch.id,
    },
  })

  if (invoiceId) await syncPaymentTransactionAmount(invoiceId)
  return transaction
}

const GENERIC_FAILURE_MESSAGE =
  'Não foi possível processar o arquivo. Tente exportar em outro formato ou verifique o conteúdo.'

/**
 * RF-02/RF-03/RF-04/RF-05/RF-06/RF-07: the background job a queue (in-process locally, Cloud
 * Tasks in production — see importQueue.ts) triggers after upload. Runs entirely inside one DB
 * transaction so a failure partway through never leaves a partially-imported batch (RF-07);
 * the final status write happens outside it, since it must persist even when the transaction
 * above rolled back.
 */
export async function processImportBatch(importBatchId: string): Promise<void> {
  const batch = await prisma.importBatch.findUniqueOrThrow({ where: { id: importBatchId } })

  try {
    if (!batch.rawContent) throw new ExtractionError('Missing file content')
    const rawContent = Buffer.from(batch.rawContent)

    const anyPending = await prisma.$transaction(
      async (tx) => {
        const rows = await extractRows(batch, rawContent)
        const destination: Destination = { accountId: batch.accountId, cardId: batch.cardId }
        const suggestCategory = await loadCategorySuggester(tx, batch.userId)

        let pending = false
        for (const row of rows) {
          const dup = await detectDuplicate(tx, batch.userId, destination, row)
          if (dup.kind === 'exact') continue

          const suggestedCategoryId = suggestCategory(row.description)
          const isDuplicateSuspect = dup.kind === 'suspect'

          const importedRow = await tx.importedRow.create({
            data: {
              importBatchId: batch.id,
              date: row.date,
              description: row.description,
              amount: row.amount,
              type: row.type,
              externalId: row.externalId ?? null,
              isDuplicateSuspect,
              duplicateOfTransactionId: isDuplicateSuspect ? dup.transactionId : null,
              suggestedCategoryId,
            },
          })

          if (batch.mode === 'direct' && dup.kind === 'none') {
            const transaction = await createTransactionFromRow(tx, batch, row, suggestedCategoryId)
            await tx.importedRow.update({
              where: { id: importedRow.id },
              data: { resolution: 'aceita', createdTransactionId: transaction.id },
            })
          } else {
            pending = true
          }
        }

        return pending
      },
      { timeout: 30_000 }
    )

    await prisma.importBatch.update({
      where: { id: batch.id },
      data: {
        status: anyPending ? 'aguardando_revisao' : 'concluido',
        rawContent: null,
        processedAt: new Date(),
      },
    })
  } catch (error) {
    const message = error instanceof ExtractionError ? error.message : GENERIC_FAILURE_MESSAGE
    await prisma.importBatch.update({
      where: { id: batch.id },
      data: { status: 'falhou', errorMessage: message, rawContent: null, processedAt: new Date() },
    })
  }
}
