import { randomUUID } from 'node:crypto'
import type { Transaction, TransactionType } from '@prisma/client'
import { prisma } from '../../config/prisma.js'
import { scopedToUser } from '../../lib/scopedToUser.js'
import { parseDateOnly } from '../../lib/dateOnly.js'
import { splitInstallments } from './installmentSplit.js'
import {
  DestinationNotFoundError,
  DestinationInactiveError,
  CategoryNotFoundError,
  CategoryTypeMismatchError,
  RefundTargetNotFoundError,
  RefundTypeMismatchError,
  RefundDestinationMismatchError,
  RefundAmountExceedsOriginalError,
  TransactionNotFoundError,
} from './transaction.errors.js'

type Destination = { accountId: string | null; cardId: string | null }

async function assertDestinationOwnedAndActive(userId: string, destination: Destination): Promise<void> {
  if (destination.accountId) {
    const account = await prisma.account.findFirst(
      scopedToUser(userId, { where: { id: destination.accountId } })
    )
    if (!account) throw new DestinationNotFoundError()
    if (!account.isActive) throw new DestinationInactiveError()
    return
  }

  const card = await prisma.card.findFirst(scopedToUser(userId, { where: { id: destination.cardId! } }))
  if (!card) throw new DestinationNotFoundError()
  if (!card.isActive) throw new DestinationInactiveError()
}

async function assertCategoryMatchesType(
  userId: string,
  categoryId: string,
  type: TransactionType
): Promise<void> {
  const category = await prisma.category.findFirst({
    where: { id: categoryId, OR: [{ userId: null }, { userId }] },
  })
  if (!category) throw new CategoryNotFoundError()
  if (category.type !== type) throw new CategoryTypeMismatchError()
}

async function assertValidRefund(
  userId: string,
  refundOfTransactionId: string,
  params: { type: TransactionType; amount: number; accountId: string | null; cardId: string | null }
): Promise<void> {
  const original = await prisma.transaction.findFirst(
    scopedToUser(userId, { where: { id: refundOfTransactionId } })
  )
  if (!original) throw new RefundTargetNotFoundError()
  if (original.type === params.type) throw new RefundTypeMismatchError()
  if (original.accountId !== params.accountId || original.cardId !== params.cardId) {
    throw new RefundDestinationMismatchError()
  }
  if (params.amount > Number(original.amount)) throw new RefundAmountExceedsOriginalError()
}

export type CreateTransactionParams = {
  type: TransactionType
  amount: number
  date: string
  description: string
  categoryId?: string
  accountId?: string
  cardId?: string
  refundOfTransactionId?: string
  installments?: number
}

export async function createTransaction(
  userId: string,
  params: CreateTransactionParams
): Promise<Transaction[]> {
  const destination: Destination = {
    accountId: params.accountId ?? null,
    cardId: params.cardId ?? null,
  }
  await assertDestinationOwnedAndActive(userId, destination)

  if (params.categoryId) {
    await assertCategoryMatchesType(userId, params.categoryId, params.type)
  }

  if (params.refundOfTransactionId) {
    await assertValidRefund(userId, params.refundOfTransactionId, {
      type: params.type,
      amount: params.amount,
      accountId: destination.accountId,
      cardId: destination.cardId,
    })
  }

  const date = parseDateOnly(params.date)

  if (params.installments) {
    const parts = splitInstallments(params.amount, params.installments, date)
    const installmentGroupId = randomUUID()

    return prisma.$transaction(
      parts.map((part) =>
        prisma.transaction.create({
          data: {
            userId,
            type: params.type,
            amount: part.amount,
            date: part.date,
            description: params.description,
            categoryId: params.categoryId ?? null,
            accountId: destination.accountId,
            cardId: destination.cardId,
            refundOfTransactionId: params.refundOfTransactionId ?? null,
            installmentGroupId,
            installmentNumber: part.installmentNumber,
            installmentCount: params.installments,
          },
        })
      )
    )
  }

  const transaction = await prisma.transaction.create({
    data: {
      userId,
      type: params.type,
      amount: params.amount,
      date,
      description: params.description,
      categoryId: params.categoryId ?? null,
      accountId: destination.accountId,
      cardId: destination.cardId,
      refundOfTransactionId: params.refundOfTransactionId ?? null,
    },
  })

  return [transaction]
}

export type ListTransactionsFilters = {
  accountId?: string
  cardId?: string
  categoryId?: string
  from?: string
  to?: string
  limit?: number
  offset?: number
}

export async function listTransactions(
  userId: string,
  filters: ListTransactionsFilters
): Promise<{ items: Transaction[]; total: number }> {
  const limit = filters.limit ?? 20
  const offset = filters.offset ?? 0

  const where = {
    ...(filters.accountId ? { accountId: filters.accountId } : {}),
    ...(filters.cardId ? { cardId: filters.cardId } : {}),
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.from || filters.to
      ? {
          date: {
            ...(filters.from ? { gte: parseDateOnly(filters.from) } : {}),
            ...(filters.to ? { lte: parseDateOnly(filters.to) } : {}),
          },
        }
      : {}),
  }

  const query = scopedToUser(userId, {
    where,
    orderBy: { date: 'desc' as const },
    take: limit,
    skip: offset,
  })

  const [items, total] = await Promise.all([
    prisma.transaction.findMany(query),
    prisma.transaction.count({ where: query.where }),
  ])

  return { items, total }
}

export async function getOwnedTransaction(userId: string, id: string): Promise<Transaction> {
  const transaction = await prisma.transaction.findFirst(scopedToUser(userId, { where: { id } }))
  if (!transaction) throw new TransactionNotFoundError()
  return transaction
}

export type UpdateTransactionParams = {
  type?: TransactionType
  amount?: number
  date?: string
  description?: string
  categoryId?: string | null
  accountId?: string
  cardId?: string
}

export async function updateTransaction(
  userId: string,
  id: string,
  params: UpdateTransactionParams,
  applyToRemaining: boolean
): Promise<Transaction> {
  const existing = await getOwnedTransaction(userId, id)

  const destination: Destination | null =
    params.accountId !== undefined
      ? { accountId: params.accountId, cardId: null }
      : params.cardId !== undefined
        ? { accountId: null, cardId: params.cardId }
        : null

  if (destination) {
    await assertDestinationOwnedAndActive(userId, destination)
  }

  const effectiveType = params.type ?? existing.type
  if (params.categoryId) {
    await assertCategoryMatchesType(userId, params.categoryId, effectiveType)
  }

  const data = {
    ...(params.type !== undefined ? { type: params.type } : {}),
    ...(params.amount !== undefined ? { amount: params.amount } : {}),
    ...(params.date !== undefined ? { date: parseDateOnly(params.date) } : {}),
    ...(params.description !== undefined ? { description: params.description } : {}),
    ...(params.categoryId !== undefined ? { categoryId: params.categoryId } : {}),
    ...(destination ? { accountId: destination.accountId, cardId: destination.cardId } : {}),
  }

  const updated = await prisma.transaction.update({ where: { id }, data })

  if (applyToRemaining && existing.installmentGroupId) {
    await prisma.transaction.updateMany({
      where: {
        installmentGroupId: existing.installmentGroupId,
        date: { gte: existing.date },
        id: { not: id },
      },
      data,
    })
  }

  return updated
}

export type DeleteScope = 'single' | 'remaining'

export async function deleteTransaction(userId: string, id: string, scope: DeleteScope): Promise<void> {
  const existing = await getOwnedTransaction(userId, id)

  if (scope === 'remaining' && existing.installmentGroupId) {
    await prisma.transaction.deleteMany({
      where: { installmentGroupId: existing.installmentGroupId, date: { gte: existing.date } },
    })
    return
  }

  await prisma.transaction.delete({ where: { id } })
}
