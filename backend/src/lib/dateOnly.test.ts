import { describe, expect, it } from 'vitest'
import { parseDateOnly, formatDateOnly, todayDateOnly } from './dateOnly.js'

describe('dateOnly', () => {
  it('round-trips a date string', () => {
    expect(formatDateOnly(parseDateOnly('2024-03-10'))).toBe('2024-03-10')
  })

  it('parses to UTC midnight', () => {
    expect(parseDateOnly('2024-03-10').toISOString()).toBe('2024-03-10T00:00:00.000Z')
  })

  it('todayDateOnly matches formatDateOnly(new Date()) at UTC midnight', () => {
    const today = todayDateOnly()
    expect(today.toISOString()).toBe(`${formatDateOnly(new Date())}T00:00:00.000Z`)
  })
})
