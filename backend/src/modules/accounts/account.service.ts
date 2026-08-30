import { Prisma, type Account } from '@prisma/client'
import { prisma } from '../../config/prisma.js'
import { scopedToUser } from '../../lib/scopedToUser.js'
import { AccountNameAlreadyExistsError, AccountNotFoundError, BankNotFoundError } from './account.errors.js'

async function assertBankExists(bankId: string): Promise<void> {
  const bank = await prisma.bank.findUnique({ where: { id: bankId } })
  if (!bank) {
    throw new BankNotFoundError()
  }
}

export async function createAccount(
  userId: string,
  params: { name: string; bankId: string; currency?: string; initialBalance: number }
): Promise<Account> {
  await assertBankExists(params.bankId)

  try {
    return await prisma.account.create({
      data: {
        userId,
        name: params.name,
        bankId: params.bankId,
        currency: params.currency ?? 'BRL',
        initialBalance: params.initialBalance,
      },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AccountNameAlreadyExistsError()
    }
    /* v8 ignore next -- defensive re-throw for unexpected DB errors, not triggerable in tests */
    throw error
  }
}

export async function listAccounts(userId: string): Promise<Account[]> {
  return prisma.account.findMany(
    scopedToUser(userId, { include: { bank: true }, orderBy: { name: 'asc' as const } })
  )
}

export async function getOwnedAccount(userId: string, id: string): Promise<Account> {
  const account = await prisma.account.findFirst(scopedToUser(userId, { where: { id } }))
  if (!account) {
    throw new AccountNotFoundError()
  }
  return account
}

export async function updateAccount(
  userId: string,
  id: string,
  params: { name?: string; bankId?: string; currency?: string }
): Promise<Account> {
  await getOwnedAccount(userId, id)

  if (params.bankId) {
    await assertBankExists(params.bankId)
  }

  try {
    return await prisma.account.update({ where: { id }, data: params })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AccountNameAlreadyExistsError()
    }
    /* v8 ignore next -- defensive re-throw for unexpected DB errors, not triggerable in tests */
    throw error
  }
}

export async function deleteAccount(userId: string, id: string): Promise<void> {
  await getOwnedAccount(userId, id)
  await prisma.account.delete({ where: { id } })
}
