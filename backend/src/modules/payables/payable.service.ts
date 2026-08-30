import { Prisma, type Payable, type TransactionType } from '@prisma/client'
import { prisma } from '../../config/prisma.js'
import { scopedToUser } from '../../lib/scopedToUser.js'
import { parseDateOnly, todayDateOnly, formatDateOnly } from '../../lib/dateOnly.js'
import { computePayableStatus, type PayableStatus } from './payableStatus.js'
import { assertAccountOwnedAndActive, attachStatus, extendRecurringHorizonsForUser, type PayableWithStatus } from './payableGroup.service.js'
import {
  PayableNotFoundError,
  PayableNotEditableError,
  PayableAlreadyPaidError,
  PayableAlreadyCancelledError,
  DeleteTransactionConfirmationRequiredError,
} from './payable.errors.js'

export type CreatePayableParams = {
  type: TransactionType
  amount: number
  dueDate: string
  description?: string
  counterparty?: string
  accountId?: string
}

/** RF-01: a standalone payable is the degenerate case of a group with a single parcela. */
export async function createPayable(userId: string, params: CreatePayableParams): Promise<Payable> {
  await assertAccountOwnedAndActive(userId, params.accountId)

  return prisma.payable.create({
    data: {
      userId,
      type: params.type,
      amount: params.amount,
      dueDate: parseDateOnly(params.dueDate),
      description: params.description ?? null,
      counterparty: params.counterparty ?? null,
      accountId: params.accountId ?? null,
    },
  })
}

export async function getOwnedPayable(userId: string, id: string): Promise<Payable> {
  const payable = await prisma.payable.findFirst(scopedToUser(userId, { where: { id } }))
  if (!payable) throw new PayableNotFoundError()
  return payable
}

export async function getPayableDetail(userId: string, id: string): Promise<PayableWithStatus> {
  const payable = await getOwnedPayable(userId, id)
  return attachStatus(payable, todayDateOnly())
}

function encodeCursor(offset: number): string {
  return Buffer.from(String(offset), 'utf-8').toString('base64url')
}

function decodeCursor(cursor: string | undefined): number {
  if (!cursor) return 0
  const decoded = Number(Buffer.from(cursor, 'base64url').toString('utf-8'))
  return Number.isFinite(decoded) && decoded >= 0 ? decoded : 0
}

export type ListPayablesFilters = {
  type?: TransactionType
  status?: PayableStatus
  until?: string
  groupId?: string
  accountId?: string
  limit?: number
  cursor?: string
}

/**
 * RF-11/RF-12: status is a derived field, so it can't be filtered at the DB level — this
 * fetches every payable matching the DB-level filters, then filters/paginates in memory. Fine
 * at this project's scale (a single user's payables); would need a different approach if this
 * ever had to scale to a very large per-user dataset.
 */
export async function listPayables(
  userId: string,
  filters: ListPayablesFilters
): Promise<{ items: PayableWithStatus[]; nextCursor: string | null }> {
  await extendRecurringHorizonsForUser(userId)

  const limit = filters.limit ?? 20
  const offset = decodeCursor(filters.cursor)
  const today = todayDateOnly()

  const where = {
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.until ? { dueDate: { lte: parseDateOnly(filters.until) } } : {}),
    ...(filters.groupId ? { groupId: filters.groupId } : {}),
    ...(filters.accountId ? { accountId: filters.accountId } : {}),
  }

  const query = scopedToUser(userId, {
    where,
    orderBy: [{ dueDate: 'asc' as const }, { createdAt: 'asc' as const }],
  })

  const matching = (await prisma.payable.findMany(query)).map((p) => attachStatus(p, today))
  const filtered = filters.status ? matching.filter((p) => p.status === filters.status) : matching

  const items = filtered.slice(offset, offset + limit)
  const nextCursor = offset + limit < filtered.length ? encodeCursor(offset + limit) : null

  return { items, nextCursor }
}

function assertPayableEditable(payable: Payable): void {
  const status = computePayableStatus(payable, todayDateOnly())
  if (status === 'paga' || status === 'cancelada') throw new PayableNotEditableError()
}

export type UpdatePayableParams = {
  amount?: number
  dueDate?: string
  description?: string | null
  counterparty?: string | null
  accountId?: string | null
}

/** RF-06: edits only this parcela, without touching its group or siblings. */
export async function updatePayable(userId: string, id: string, params: UpdatePayableParams): Promise<Payable> {
  const existing = await getOwnedPayable(userId, id)
  assertPayableEditable(existing)
  if (params.accountId) await assertAccountOwnedAndActive(userId, params.accountId)

  return prisma.payable.update({
    where: { id },
    data: {
      ...(params.amount !== undefined ? { amount: params.amount } : {}),
      ...(params.dueDate !== undefined ? { dueDate: parseDateOnly(params.dueDate) } : {}),
      ...(params.description !== undefined ? { description: params.description } : {}),
      ...(params.counterparty !== undefined ? { counterparty: params.counterparty } : {}),
      ...(params.accountId !== undefined ? { accountId: params.accountId } : {}),
    },
  })
}

/** RF-05: registers a payment/receipt, creating the linked Transaction (Etapa 3). */
export async function payPayable(
  userId: string,
  id: string,
  params: { accountId: string; paidAmount?: number; date?: string }
): Promise<Payable> {
  const existing = await getOwnedPayable(userId, id)
  const status = computePayableStatus(existing, todayDateOnly())
  if (status === 'paga') throw new PayableAlreadyPaidError()
  if (status === 'cancelada') throw new PayableAlreadyCancelledError()

  await assertAccountOwnedAndActive(userId, params.accountId)

  const amount = params.paidAmount ?? Number(existing.amount)
  const date = params.date ? parseDateOnly(params.date) : todayDateOnly()

  const transaction = await prisma.transaction.create({
    data: {
      userId,
      type: existing.type,
      amount,
      date,
      description: existing.description ?? 'Conta a pagar/receber',
      accountId: params.accountId,
    },
  })

  return prisma.payable.update({
    where: { id },
    data: { paidAmount: amount, paidTransactionId: transaction.id, paidAt: new Date() },
  })
}

async function confirmationForLinkedTransaction(paidTransactionId: string) {
  const transaction = await prisma.transaction.findUniqueOrThrow({ where: { id: paidTransactionId } })
  return new DeleteTransactionConfirmationRequiredError({
    id: transaction.id,
    amount: transaction.amount.toString(),
    date: formatDateOnly(transaction.date),
    accountId: transaction.accountId,
  })
}

/** RF-08: cancels a parcela; cancelling an already-paid one also removes its linked Transaction. */
export async function cancelPayable(
  userId: string,
  id: string,
  params: { cancellationReason?: string; confirmDeleteTransaction?: boolean }
): Promise<Payable> {
  const existing = await getOwnedPayable(userId, id)
  const status = computePayableStatus(existing, todayDateOnly())
  if (status === 'cancelada') throw new PayableAlreadyCancelledError()

  if (status === 'paga') {
    if (!params.confirmDeleteTransaction) {
      throw await confirmationForLinkedTransaction(existing.paidTransactionId!)
    }
    // Updates the Payable to drop its paidTransactionId *before* deleting the Transaction:
    // the FK's ON DELETE SET NULL would otherwise null out paid_transaction_id as a side
    // effect of the delete while paid_at is still set, tripping the "both null or both set"
    // CHECK constraint immediately (Postgres checks it per-statement, not deferred).
    const [updated] = await prisma.$transaction([
      prisma.payable.update({
        where: { id },
        data: {
          cancelledAt: new Date(),
          cancellationReason: params.cancellationReason ?? null,
          paidTransactionId: null,
          paidAt: null,
          paidAmount: null,
        },
      }),
      prisma.transaction.delete({ where: { id: existing.paidTransactionId! } }),
    ])
    return updated
  }

  return prisma.payable.update({
    where: { id },
    data: { cancelledAt: new Date(), cancellationReason: params.cancellationReason ?? null },
  })
}

/** RF-09: permanently removes the parcela; if already paid, requires confirming the cascade. */
export async function deletePayable(
  userId: string,
  id: string,
  confirmDeleteTransaction: boolean | undefined
): Promise<void> {
  const existing = await getOwnedPayable(userId, id)

  if (existing.paidTransactionId) {
    if (!confirmDeleteTransaction) {
      throw await confirmationForLinkedTransaction(existing.paidTransactionId)
    }
    await prisma.$transaction([
      prisma.payable.delete({ where: { id } }),
      prisma.transaction.delete({ where: { id: existing.paidTransactionId } }),
    ])
    return
  }

  await prisma.payable.delete({ where: { id } })
}

/** RF-11: totals of not-yet-paid/cancelled parcelas due on or before `until`. */
export async function getPayablesSummary(
  userId: string,
  until: string
): Promise<{ totalPayable: string; totalReceivable: string }> {
  await extendRecurringHorizonsForUser(userId)

  const payables = await prisma.payable.findMany({
    where: { userId, dueDate: { lte: parseDateOnly(until) }, paidTransactionId: null, cancelledAt: null },
  })

  let totalPayable = new Prisma.Decimal(0)
  let totalReceivable = new Prisma.Decimal(0)
  for (const payable of payables) {
    if (payable.type === 'expense') totalPayable = totalPayable.plus(payable.amount)
    else totalReceivable = totalReceivable.plus(payable.amount)
  }

  return { totalPayable: totalPayable.toString(), totalReceivable: totalReceivable.toString() }
}

/** RF-11: net effect (income - expense) of an account's not-yet-paid/cancelled parcelas due by `date`. */
export async function calculateProjectedAdjustment(accountId: string, date: Date): Promise<Prisma.Decimal> {
  const [incomeSum, expenseSum] = await Promise.all([
    prisma.payable.aggregate({
      where: { accountId, type: 'income', paidTransactionId: null, cancelledAt: null, dueDate: { lte: date } },
      _sum: { amount: true },
    }),
    prisma.payable.aggregate({
      where: { accountId, type: 'expense', paidTransactionId: null, cancelledAt: null, dueDate: { lte: date } },
      _sum: { amount: true },
    }),
  ])
  return new Prisma.Decimal(incomeSum._sum.amount ?? 0).minus(expenseSum._sum.amount ?? 0)
}
