import { Prisma, type Bank } from '@prisma/client'
import { prisma } from '../../config/prisma.js'
import { BankCodeAlreadyExistsError } from './bank.errors.js'

export async function listBanks(): Promise<Bank[]> {
  return prisma.bank.findMany({ orderBy: { name: 'asc' } })
}

export async function createBank(params: { name: string; code: string }): Promise<Bank> {
  try {
    return await prisma.bank.create({ data: params })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new BankCodeAlreadyExistsError()
    }
    /* v8 ignore next -- defensive re-throw for unexpected DB errors, not triggerable in tests */
    throw error
  }
}
