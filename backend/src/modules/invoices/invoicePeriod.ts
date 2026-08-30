/** UTC date for `day` in `year`/`month` (1-12), clamped to the last valid day of that month. */
function dayInMonth(year: number, month: number, day: number): Date {
  const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const clampedDay = Math.min(day, lastDayOfMonth)
  return new Date(Date.UTC(year, month - 1, clampedDay))
}

export type InvoicePeriod = { periodYear: number; periodMonth: number }

/**
 * closingDate/dueDate for a given invoice period (RF-02). `periodMonth`/`periodYear` are the
 * invoice's due month/year. The closing date falls in the same month if dueDay is after
 * closingDay in the calendar, otherwise in the month before (matches how Brazilian card
 * statements normally work: e.g. closes on the 20th, due on the 5th of the following month).
 */
export function computeInvoiceDates(
  period: InvoicePeriod,
  closingDay: number,
  dueDay: number
): { closingDate: Date; dueDate: Date } {
  const dueDate = dayInMonth(period.periodYear, period.periodMonth, dueDay)

  let closingYear = period.periodYear
  let closingMonth = period.periodMonth
  if (dueDay <= closingDay) {
    closingMonth -= 1
    if (closingMonth === 0) {
      closingMonth = 12
      closingYear -= 1
    }
  }
  const closingDate = dayInMonth(closingYear, closingMonth, closingDay)

  return { closingDate, dueDate }
}

export function nextPeriod(period: InvoicePeriod): InvoicePeriod {
  const periodMonth = (period.periodMonth % 12) + 1
  const periodYear = period.periodMonth === 12 ? period.periodYear + 1 : period.periodYear
  return { periodYear, periodMonth }
}

/**
 * Earlier of two periods. Used when starting invoice generation for a card with no invoices
 * yet: starting purely from the card's creation month would misfile a backdated transaction
 * (e.g. logging last month's purchase right after creating the card) into the wrong period, so
 * the walk instead starts from whichever is earlier — the creation month or the target date's
 * own month — and advances forward from there until it covers the target date.
 */
export function earlierPeriod(a: InvoicePeriod, b: InvoicePeriod): InvoicePeriod {
  if (a.periodYear !== b.periodYear) return a.periodYear < b.periodYear ? a : b
  return a.periodMonth <= b.periodMonth ? a : b
}
