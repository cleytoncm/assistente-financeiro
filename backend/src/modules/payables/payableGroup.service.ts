import type { Payable, PayableGroup, TransactionType } from '@prisma/client'
import { prisma } from '../../config/prisma.js'
import { scopedToUser } from '../../lib/scopedToUser.js'
import { parseDateOnly, todayDateOnly, formatDateOnly } from '../../lib/dateOnly.js'
import { generateDueDates, nextDueDate, monthsBetween, withDueDay } from './payableSchedule.js'
import { computePayableStatus, type PayableStatus } from './payableStatus.js'
import {
  PayableGroupNotFoundError,
  PayableAccountNotFoundError,
  PayableAccountInactiveError,
  DeleteTransactionsConfirmationRequiredError,
} from './payable.errors.js'

const RECURRING_BATCH_SIZE = 6
const RECURRING_EXTEND_THRESHOLD_MONTHS = 3

export async function assertAccountOwnedAndActive(
  userId: string,
  accountId: string | undefined | null
): Promise<void> {
  if (!accountId) return
  const account = await prisma.account.findFirst(scopedToUser(userId, { where: { id: accountId } }))
  if (!account) throw new PayableAccountNotFoundError()
  if (!account.isActive) throw new PayableAccountInactiveError()
}

export type PayableWithStatus = Payable & { status: PayableStatus }

export function attachStatus(payable: Payable, today: Date): PayableWithStatus {
  return { ...payable, status: computePayableStatus(payable, today) }
}

export type CreatePayableGroupParams = {
  type: TransactionType
  recurrenceType: 'installment' | 'recurring'
  amount: number
  dueDay: number
  startDate: string
  installmentCount?: number
  description?: string
  counterparty?: string
  accountId?: string
}

/** RF-02/RF-03: creates the group and materializes its parcelas in the same operation. */
export async function createPayableGroup(
  userId: string,
  params: CreatePayableGroupParams
): Promise<PayableGroup> {
  await assertAccountOwnedAndActive(userId, params.accountId)

  const start = parseDateOnly(params.startDate)
  const count = params.recurrenceType === 'installment' ? params.installmentCount! : RECURRING_BATCH_SIZE
  const dueDates = generateDueDates(start, params.dueDay, count)

  const group = await prisma.payableGroup.create({
    data: {
      userId,
      type: params.type,
      recurrenceType: params.recurrenceType,
      installmentCount: params.recurrenceType === 'installment' ? params.installmentCount : null,
      amount: params.amount,
      dueDay: params.dueDay,
      description: params.description ?? null,
      counterparty: params.counterparty ?? null,
      accountId: params.accountId ?? null,
    },
  })

  await prisma.payable.createMany({
    data: dueDates.map((dueDate, index) => ({
      userId,
      groupId: group.id,
      type: params.type,
      amount: params.amount,
      dueDate,
      installmentNumber: index + 1,
      description: params.description ?? null,
      counterparty: params.counterparty ?? null,
      accountId: params.accountId ?? null,
    })),
  })

  return group
}

/**
 * RF-03: extends a recurring group's materialized horizon by another batch of 6 monthly
 * parcelas once fewer than 3 months of runway remain, continuing installmentNumber
 * sequentially across batches (never restarting at 1).
 */
export async function extendRecurringHorizon(group: PayableGroup): Promise<void> {
  if (group.recurrenceType !== 'recurring') return

  const lastActive = await prisma.payable.aggregate({
    where: { groupId: group.id, cancelledAt: null },
    _max: { dueDate: true },
  })
  const lastDueDate = lastActive._max.dueDate
  if (!lastDueDate) return

  const today = todayDateOnly()
  if (monthsBetween(today, lastDueDate) >= RECURRING_EXTEND_THRESHOLD_MONTHS) return

  const maxInstallmentNumber = await prisma.payable.aggregate({
    where: { groupId: group.id },
    _max: { installmentNumber: true },
  })
  const startNumber = (maxInstallmentNumber._max.installmentNumber ?? 0) + 1

  const dueDates: Date[] = []
  let cursor = lastDueDate
  for (let i = 0; i < RECURRING_BATCH_SIZE; i++) {
    cursor = nextDueDate(cursor, group.dueDay)
    dueDates.push(cursor)
  }

  await prisma.payable.createMany({
    data: dueDates.map((dueDate, index) => ({
      userId: group.userId,
      groupId: group.id,
      type: group.type,
      amount: group.amount,
      dueDate,
      installmentNumber: startNumber + index,
      description: group.description,
      counterparty: group.counterparty,
      accountId: group.accountId,
    })),
  })
}

export async function extendRecurringHorizonsForUser(userId: string): Promise<void> {
  const groups = await prisma.payableGroup.findMany({ where: { userId, recurrenceType: 'recurring' } })
  for (const group of groups) {
    await extendRecurringHorizon(group)
  }
}

export async function getOwnedPayableGroup(userId: string, id: string): Promise<PayableGroup> {
  const group = await prisma.payableGroup.findFirst(scopedToUser(userId, { where: { id } }))
  if (!group) throw new PayableGroupNotFoundError()
  return group
}

export type PayableGroupSummary = PayableGroup & { payableCount: number; nextDueDate: string | null }

export async function listPayableGroups(
  userId: string,
  filters: { type?: TransactionType } = {}
): Promise<PayableGroupSummary[]> {
  await extendRecurringHorizonsForUser(userId)

  const groups = await prisma.payableGroup.findMany(
    scopedToUser(userId, {
      where: filters.type ? { type: filters.type } : {},
      orderBy: { createdAt: 'desc' as const },
    })
  )

  return Promise.all(
    groups.map(async (group) => {
      const [payableCount, next] = await Promise.all([
        prisma.payable.count({ where: { groupId: group.id, cancelledAt: null } }),
        prisma.payable.findFirst({
          where: { groupId: group.id, cancelledAt: null, paidTransactionId: null },
          orderBy: { dueDate: 'asc' },
        }),
      ])
      return { ...group, payableCount, nextDueDate: next ? formatDateOnly(next.dueDate) : null }
    })
  )
}

export type PayableGroupDetail = PayableGroup & { payables: PayableWithStatus[] }

export async function getPayableGroupDetail(userId: string, id: string): Promise<PayableGroupDetail> {
  const group = await getOwnedPayableGroup(userId, id)
  await extendRecurringHorizon(group)

  const today = todayDateOnly()
  const payables = await prisma.payable.findMany({
    where: { groupId: id },
    orderBy: { installmentNumber: 'asc' },
  })

  return { ...group, payables: payables.map((p) => attachStatus(p, today)) }
}

export type UpdatePayableGroupParams = {
  amount?: number
  dueDay?: number
  description?: string | null
  counterparty?: string | null
  accountId?: string | null
}

/** RF-07: edits the group and cascades the same fields into its not-yet-paid/cancelled parcelas. */
export async function updatePayableGroup(
  userId: string,
  id: string,
  params: UpdatePayableGroupParams
): Promise<PayableGroup> {
  await getOwnedPayableGroup(userId, id)
  if (params.accountId) await assertAccountOwnedAndActive(userId, params.accountId)

  const updated = await prisma.payableGroup.update({
    where: { id },
    data: {
      ...(params.amount !== undefined ? { amount: params.amount } : {}),
      ...(params.dueDay !== undefined ? { dueDay: params.dueDay } : {}),
      ...(params.description !== undefined ? { description: params.description } : {}),
      ...(params.counterparty !== undefined ? { counterparty: params.counterparty } : {}),
      ...(params.accountId !== undefined ? { accountId: params.accountId } : {}),
    },
  })

  const editablePayables = await prisma.payable.findMany({
    where: { groupId: id, paidTransactionId: null, cancelledAt: null },
  })

  for (const payable of editablePayables) {
    await prisma.payable.update({
      where: { id: payable.id },
      data: {
        ...(params.amount !== undefined ? { amount: params.amount } : {}),
        ...(params.dueDay !== undefined ? { dueDate: withDueDay(payable.dueDate, params.dueDay) } : {}),
        ...(params.description !== undefined ? { description: params.description } : {}),
        ...(params.counterparty !== undefined ? { counterparty: params.counterparty } : {}),
        ...(params.accountId !== undefined ? { accountId: params.accountId } : {}),
      },
    })
  }

  return updated
}

/** RF-10: `pending` only removes not-yet-paid/cancelled parcelas; `all` also removes paid ones. */
export async function deletePayableGroup(
  userId: string,
  id: string,
  scope: 'pending' | 'all',
  confirmDeleteTransactions: boolean | undefined
): Promise<void> {
  await getOwnedPayableGroup(userId, id)

  if (scope === 'pending') {
    await prisma.payable.deleteMany({ where: { groupId: id, paidTransactionId: null, cancelledAt: null } })
    return
  }

  const paidPayables = await prisma.payable.findMany({
    where: { groupId: id, paidTransactionId: { not: null } },
  })
  if (paidPayables.length > 0 && !confirmDeleteTransactions) {
    throw new DeleteTransactionsConfirmationRequiredError(paidPayables.length)
  }

  const paidTransactionIds = paidPayables
    .map((p) => p.paidTransactionId)
    .filter((v): v is string => v !== null)

  await prisma.$transaction([
    prisma.payable.deleteMany({ where: { groupId: id } }),
    ...(paidTransactionIds.length > 0
      ? [prisma.transaction.deleteMany({ where: { id: { in: paidTransactionIds } } })]
      : []),
    prisma.payableGroup.delete({ where: { id } }),
  ])
}
