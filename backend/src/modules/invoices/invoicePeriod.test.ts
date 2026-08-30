import { describe, expect, it } from 'vitest'
import { computeInvoiceDates, nextPeriod, earlierPeriod } from './invoicePeriod.js'

describe('computeInvoiceDates', () => {
  it('places closing in the previous month when dueDay <= closingDay', () => {
    const { closingDate, dueDate } = computeInvoiceDates({ periodYear: 2024, periodMonth: 3 }, 20, 5)
    expect(closingDate.toISOString().slice(0, 10)).toBe('2024-02-20')
    expect(dueDate.toISOString().slice(0, 10)).toBe('2024-03-05')
  })

  it('places closing in the same month when dueDay > closingDay', () => {
    const { closingDate, dueDate } = computeInvoiceDates({ periodYear: 2024, periodMonth: 3 }, 5, 15)
    expect(closingDate.toISOString().slice(0, 10)).toBe('2024-03-05')
    expect(dueDate.toISOString().slice(0, 10)).toBe('2024-03-15')
  })

  it('rolls the closing month back across a year boundary', () => {
    const { closingDate } = computeInvoiceDates({ periodYear: 2024, periodMonth: 1 }, 20, 5)
    expect(closingDate.toISOString().slice(0, 10)).toBe('2023-12-20')
  })

  it('clamps day 31 to the last valid day of a shorter month', () => {
    const { dueDate } = computeInvoiceDates({ periodYear: 2024, periodMonth: 2 }, 1, 31)
    expect(dueDate.toISOString().slice(0, 10)).toBe('2024-02-29') // 2024 is a leap year
  })
})

describe('nextPeriod', () => {
  it('increments the month within the same year', () => {
    expect(nextPeriod({ periodYear: 2024, periodMonth: 3 })).toEqual({ periodYear: 2024, periodMonth: 4 })
  })

  it('rolls over to January of the next year', () => {
    expect(nextPeriod({ periodYear: 2024, periodMonth: 12 })).toEqual({ periodYear: 2025, periodMonth: 1 })
  })
})

describe('earlierPeriod', () => {
  it('picks the earlier year', () => {
    const a = { periodYear: 2023, periodMonth: 12 }
    const b = { periodYear: 2024, periodMonth: 1 }
    expect(earlierPeriod(a, b)).toEqual(a)
    expect(earlierPeriod(b, a)).toEqual(a)
  })

  it('picks the earlier month within the same year', () => {
    const a = { periodYear: 2024, periodMonth: 3 }
    const b = { periodYear: 2024, periodMonth: 6 }
    expect(earlierPeriod(a, b)).toEqual(a)
    expect(earlierPeriod(b, a)).toEqual(a)
  })

  it('returns the first argument when both periods are equal', () => {
    const period = { periodYear: 2024, periodMonth: 3 }
    expect(earlierPeriod(period, { ...period })).toEqual(period)
  })
})
