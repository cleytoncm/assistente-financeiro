import { Prisma, type Card } from '@prisma/client'
import { prisma } from '../../config/prisma.js'
import { scopedToUser } from '../../lib/scopedToUser.js'
import { CardNameAlreadyExistsError, CardNotFoundError, LinkedAccountNotFoundError } from './card.errors.js'

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
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new CardNameAlreadyExistsError()
    }
    /* v8 ignore next -- defensive re-throw for unexpected DB errors, not triggerable in tests */
    throw error
  }
}

export async function listCards(userId: string): Promise<Card[]> {
  return prisma.card.findMany(
    scopedToUser(userId, { include: { linkedAccount: true }, orderBy: { name: 'asc' as const } })
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
    return await prisma.card.update({ where: { id }, data: params })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new CardNameAlreadyExistsError()
    }
    /* v8 ignore next -- defensive re-throw for unexpected DB errors, not triggerable in tests */
    throw error
  }
}

export async function deleteCard(userId: string, id: string): Promise<void> {
  await getOwnedCard(userId, id)
  await prisma.card.delete({ where: { id } })
}
