import { Prisma, type Category, type TransactionType } from '@prisma/client'
import { prisma } from '../../config/prisma.js'
import { CategoryAlreadyExistsError } from './category.errors.js'

export async function listCategories(userId: string): Promise<Category[]> {
  return prisma.category.findMany({
    where: { OR: [{ userId: null }, { userId }] },
    orderBy: { name: 'asc' },
  })
}

export async function createCategory(
  userId: string,
  params: { name: string; type: TransactionType }
): Promise<Category> {
  try {
    return await prisma.category.create({
      data: { userId, name: params.name, type: params.type },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new CategoryAlreadyExistsError()
    }
    /* v8 ignore next -- defensive re-throw for unexpected DB errors, not triggerable in tests */
    throw error
  }
}
