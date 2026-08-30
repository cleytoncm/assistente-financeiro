import { Prisma, type Account } from '@prisma/client'
import { prisma } from '../../config/prisma.js'
import { scopedToUser } from '../../lib/scopedToUser.js'
import { todayDateOnly, parseDateOnly } from '../../lib/dateOnly.js'
import { netAmount } from '../transactions/balanceMath.js'
import {
  AccountHasTransactionsError,
  AccountNameAlreadyExistsError,
  AccountNotFoundError,
  BankNotFoundError,
} from './account.errors.js'

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
      include: { bank: true },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AccountNameAlreadyExistsError()
    }
    /* v8 ignore next -- defensive re-throw for unexpected DB errors, not triggerable in tests */
    throw error
  }
}

async function calculateBalance(account: Account, date: Date): Promise<Prisma.Decimal> {
  const [incomeSum, expenseSum] = await Promise.all([
    prisma.transaction.aggregate({
      where: { accountId: account.id, type: 'income', date: { lte: date } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { accountId: account.id, type: 'expense', date: { lte: date } },
      _sum: { amount: true },
    }),
  ])
  return netAmount(account.initialBalance, incomeSum._sum.amount ?? 0, expenseSum._sum.amount ?? 0)
}

export type AccountWithBalance = Account & { currentBalance: string }

export async function listAccounts(
  userId: string,
  options: { date?: string; includeHidden?: boolean } = {}
): Promise<AccountWithBalance[]> {
  const date = options.date ? parseDateOnly(options.date) : todayDateOnly()

  const accounts = await prisma.account.findMany(
    scopedToUser(userId, {
      where: options.includeHidden ? {} : { isHidden: false },
      include: { bank: true },
      orderBy: { name: 'asc' as const },
    })
  )

  return Promise.all(
    accounts.map(async (account) => ({
      ...account,
      currentBalance: (await calculateBalance(account, date)).toString(),
    }))
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
    return await prisma.account.update({ where: { id }, data: params, include: { bank: true } })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AccountNameAlreadyExistsError()
    }
    /* v8 ignore next -- defensive re-throw for unexpected DB errors, not triggerable in tests */
    throw error
  }
}

export async function updateAccountStatus(
  userId: string,
  id: string,
  params: { isActive?: boolean; isHidden?: boolean }
): Promise<Account> {
  await getOwnedAccount(userId, id)
  return prisma.account.update({
    where: { id },
    data: {
      ...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
      ...(params.isHidden !== undefined ? { isHidden: params.isHidden } : {}),
    },
  })
}

export async function deleteAccount(userId: string, id: string, cascade: boolean): Promise<void> {
  await getOwnedAccount(userId, id)

  const transactionCount = await prisma.transaction.count({ where: { accountId: id } })
  if (transactionCount > 0 && !cascade) {
    throw new AccountHasTransactionsError()
  }

  if (transactionCount > 0) {
    await prisma.$transaction([
      prisma.transaction.deleteMany({ where: { accountId: id } }),
      prisma.account.delete({ where: { id } }),
    ])
    return
  }

  await prisma.account.delete({ where: { id } })
}
