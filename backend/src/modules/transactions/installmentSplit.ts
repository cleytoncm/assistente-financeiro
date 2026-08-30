import { Prisma } from '@prisma/client'

export type InstallmentPart = {
  amount: Prisma.Decimal
  date: Date
  installmentNumber: number
}

/**
 * Splits a total purchase amount into `count` monthly installments (RF-02).
 * Each installment (except the last) is `floor(total / count * 100) / 100`; the last one
 * absorbs the rounding residual so the parts always sum exactly to `totalAmount`.
 * Dates keep the same day-of-month as `firstDate`, one month apart.
 */
export function splitInstallments(
  totalAmount: Prisma.Decimal.Value,
  count: number,
  firstDate: Date
): InstallmentPart[] {
  const total = new Prisma.Decimal(totalAmount)
  const perInstallment = total.dividedBy(count).toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN)

  const parts: InstallmentPart[] = []
  let runningSum = new Prisma.Decimal(0)

  for (let i = 0; i < count - 1; i++) {
    parts.push({ amount: perInstallment, date: addMonths(firstDate, i), installmentNumber: i + 1 })
    runningSum = runningSum.plus(perInstallment)
  }

  parts.push({
    amount: total.minus(runningSum),
    date: addMonths(firstDate, count - 1),
    installmentNumber: count,
  })

  return parts
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date)
  result.setUTCMonth(result.getUTCMonth() + months)
  return result
}
