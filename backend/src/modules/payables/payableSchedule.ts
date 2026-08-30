/** UTC date for `day` in `year`/`month` (1-12), clamped to the last valid day of that month. */
export function dayInMonth(year: number, month: number, day: number): Date {
  const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const clampedDay = Math.min(day, lastDayOfMonth)
  return new Date(Date.UTC(year, month - 1, clampedDay))
}

/** `date` with its day-of-month replaced by `day` (clamped), keeping the same year/month (RF-07). */
export function withDueDay(date: Date, day: number): Date {
  return dayInMonth(date.getUTCFullYear(), date.getUTCMonth() + 1, day)
}

/**
 * Due dates for `count` monthly installments (RF-02) or a recurrence batch (RF-03), starting
 * in `startDate`'s own month. Each due date lands on `dueDay` (clamped to the last valid day
 * of its month), one month apart — same "day of month" convention as card installments.
 */
export function generateDueDates(startDate: Date, dueDay: number, count: number): Date[] {
  const dates: Date[] = []
  for (let i = 0; i < count; i++) {
    const year = startDate.getUTCFullYear()
    const month = startDate.getUTCMonth() + 1 + i
    dates.push(dayInMonth(year, month, dueDay))
  }
  return dates
}

/** The due date one month after `lastDueDate`, used to continue a recurrence's cadence (RF-03). */
export function nextDueDate(lastDueDate: Date, dueDay: number): Date {
  return dayInMonth(lastDueDate.getUTCFullYear(), lastDueDate.getUTCMonth() + 2, dueDay)
}

/** Months between `from` and `to` (whole calendar months, ignoring day-of-month). */
export function monthsBetween(from: Date, to: Date): number {
  return (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth())
}
