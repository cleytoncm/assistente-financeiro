/** Parses a "YYYY-MM-DD" string into a UTC-midnight Date, matching a Postgres DATE column. */
export function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`)
}

export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** Today's date, at UTC midnight, matching the granularity of a DATE column. */
export function todayDateOnly(): Date {
  return parseDateOnly(formatDateOnly(new Date()))
}
