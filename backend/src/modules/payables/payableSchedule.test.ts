import { describe, expect, it } from 'vitest'
import { generateDueDates, nextDueDate, monthsBetween, dayInMonth, withDueDay } from './payableSchedule.js'

function iso(date: Date): string {
  return date.toISOString().slice(0, 10)
}

describe('generateDueDates', () => {
  it('generates one due date per month starting in startDate’s own month', () => {
    const dates = generateDueDates(new Date('2024-01-15T00:00:00.000Z'), 10, 3)
    expect(dates.map(iso)).toEqual(['2024-01-10', '2024-02-10', '2024-03-10'])
  })

  it('clamps dueDay to the last valid day of shorter months', () => {
    const dates = generateDueDates(new Date('2024-01-01T00:00:00.000Z'), 31, 3)
    expect(dates.map(iso)).toEqual(['2024-01-31', '2024-02-29', '2024-03-31'])
  })

  it('rolls over a year boundary', () => {
    const dates = generateDueDates(new Date('2024-11-01T00:00:00.000Z'), 5, 3)
    expect(dates.map(iso)).toEqual(['2024-11-05', '2024-12-05', '2025-01-05'])
  })
})

describe('nextDueDate', () => {
  it('advances one month, keeping dueDay', () => {
    expect(iso(nextDueDate(new Date('2024-03-10T00:00:00.000Z'), 10))).toBe('2024-04-10')
  })

  it('rolls over a year boundary', () => {
    expect(iso(nextDueDate(new Date('2024-12-05T00:00:00.000Z'), 5))).toBe('2025-01-05')
  })

  it('clamps dueDay to the last valid day of the next month', () => {
    expect(iso(nextDueDate(new Date('2024-01-31T00:00:00.000Z'), 31))).toBe('2024-02-29')
  })
})

describe('monthsBetween', () => {
  it('counts whole calendar months regardless of day-of-month', () => {
    expect(monthsBetween(new Date('2024-01-31T00:00:00.000Z'), new Date('2024-04-01T00:00:00.000Z'))).toBe(3)
  })

  it('is zero within the same month', () => {
    expect(monthsBetween(new Date('2024-01-01T00:00:00.000Z'), new Date('2024-01-31T00:00:00.000Z'))).toBe(0)
  })

  it('is negative when to is before from', () => {
    expect(monthsBetween(new Date('2024-03-01T00:00:00.000Z'), new Date('2024-01-01T00:00:00.000Z'))).toBe(-2)
  })
})

describe('dayInMonth', () => {
  it('returns the given day in the given month', () => {
    expect(iso(dayInMonth(2024, 3, 15))).toBe('2024-03-15')
  })

  it('clamps to the last valid day of a shorter month', () => {
    expect(iso(dayInMonth(2024, 2, 31))).toBe('2024-02-29')
  })
})

describe('withDueDay', () => {
  it('replaces the day of month, keeping year/month', () => {
    expect(iso(withDueDay(new Date('2024-03-05T00:00:00.000Z'), 20))).toBe('2024-03-20')
  })

  it('clamps to the last valid day of that same month', () => {
    expect(iso(withDueDay(new Date('2024-02-05T00:00:00.000Z'), 31))).toBe('2024-02-29')
  })
})
