import { Prisma, type Card } from '@prisma/client'
import { prisma } from '../../config/prisma.js'
import { scopedToUser } from '../../lib/scopedToUser.js'
import { todayDateOnly, parseDateOnly } from '../../lib/dateOnly.js'
import { netAmount, computeAvailableLimit } from '../transactions/balanceMath.js'
import {
  CardHasTransactionsError,
  CardNameAlreadyExistsError,
  CardNotFoundError,
  LinkedAccountNotFoundError,
} from './card.errors.js'

async function assertLinkedAccountOwnedByUser(userId: string, accountId: string): Promise<void> {
  const account = await prisma.account.findFirst(scopedToUser(userId, { where: { id: accountId } }))
  if (!account) {
    throw new LinkedAccountNotFoundError()
  }
}

export async function createCard(
  userId: string,
  params: {
    name: string
    creditLimit: number
    closingDay: number
    dueDay: number
    linkedAccountId?: string
  }
): Promise<Card> {
  if (params.linkedAccountId) {
    await assertLinkedAccountOwnedByUser(userId, params.linkedAccountId)
  }

  try {
    return await prisma.card.create({
      data: {
        userId,
        name: params.name,
        creditLimit: params.creditLimit,
        closingDay: params.closingDay,
        dueDay: params.dueDay,
        linkedAccountId: params.linkedAccountId ?? null,
      },
      include: { linkedAccount: true },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new CardNameAlreadyExistsError()
    }
    /* v8 ignore next -- defensive re-throw for unexpected DB errors, not triggerable in tests */
    throw error
  }
}

async function calculateSpending(card: Card, date: Date): Promise<Prisma.Decimal> {
  const [expenseSum, incomeSum] = await Promise.all([
    prisma.transaction.aggregate({
      where: { cardId: card.id, type: 'expense', date: { lte: date } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { cardId: card.id, type: 'income', date: { lte: date } },
      _sum: { amount: true },
    }),
  ])
  return netAmount(0, expenseSum._sum.amount ?? 0, incomeSum._sum.amount ?? 0)
}

export type CardWithSpending = Card & { currentSpending: string; availableLimit: string }

export async function listCards(
  userId: string,
  options: { date?: string; includeHidden?: boolean } = {}
): Promise<CardWithSpending[]> {
  const date = options.date ? parseDateOnly(options.date) : todayDateOnly()

  const cards = await prisma.card.findMany(
    scopedToUser(userId, {
      where: options.includeHidden ? {} : { isHidden: false },
      include: { linkedAccount: true },
      orderBy: { name: 'asc' as const },
    })
  )

  return Promise.all(
    cards.map(async (card) => {
      const currentSpending = await calculateSpending(card, date)
      return {
        ...card,
        currentSpending: currentSpending.toString(),
        availableLimit: computeAvailableLimit(card.creditLimit, currentSpending).toString(),
      }
    })
  )
}

export async function getOwnedCard(userId: string, id: string): Promise<Card> {
  const card = await prisma.card.findFirst(scopedToUser(userId, { where: { id } }))
  if (!card) {
    throw new CardNotFoundError()
  }
  return card
}

export async function updateCard(
  userId: string,
  id: string,
  params: {
    name?: string
    creditLimit?: number
    closingDay?: number
    dueDay?: number
    linkedAccountId?: string | null
  }
): Promise<Card> {
  await getOwnedCard(userId, id)

  if (params.linkedAccountId) {
    await assertLinkedAccountOwnedByUser(userId, params.linkedAccountId)
  }

  try {
    return await prisma.card.update({ where: { id }, data: params, include: { linkedAccount: true } })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new CardNameAlreadyExistsError()
    }
    /* v8 ignore next -- defensive re-throw for unexpected DB errors, not triggerable in tests */
    throw error
  }
}

export async function updateCardStatus(
  userId: string,
  id: string,
  params: { isActive?: boolean; isHidden?: boolean }
): Promise<Card> {
  await getOwnedCard(userId, id)
  return prisma.card.update({
    where: { id },
    data: {
      ...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
      ...(params.isHidden !== undefined ? { isHidden: params.isHidden } : {}),
    },
  })
}

export async function deleteCard(userId: string, id: string, cascade: boolean): Promise<void> {
  await getOwnedCard(userId, id)

  const transactionCount = await prisma.transaction.count({ where: { cardId: id } })
  if (transactionCount > 0 && !cascade) {
    throw new CardHasTransactionsError()
  }

  if (transactionCount > 0) {
    await prisma.$transaction([
      prisma.transaction.deleteMany({ where: { cardId: id } }),
      prisma.card.delete({ where: { id } }),
    ])
    return
  }

  await prisma.card.delete({ where: { id } })
}
