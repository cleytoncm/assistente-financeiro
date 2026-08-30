import { Prisma } from '@prisma/client'

/**
 * base + positiveSum - negativeSum, using exact decimal arithmetic (never floating point).
 * Used for both account balance (base=initial_balance, positive=income, negative=expense) and
 * card spending (base=0, positive=expense, negative=income — a refund reduces spending).
 */
export function netAmount(
  base: Prisma.Decimal.Value,
  positiveSum: Prisma.Decimal.Value,
  negativeSum: Prisma.Decimal.Value
): Prisma.Decimal {
  return new Prisma.Decimal(base).plus(positiveSum).minus(negativeSum)
}

export function computeAvailableLimit(
  creditLimit: Prisma.Decimal.Value,
  currentSpending: Prisma.Decimal.Value
): Prisma.Decimal {
  return new Prisma.Decimal(creditLimit).minus(currentSpending)
}
