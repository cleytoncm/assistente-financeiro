import { describe, expect, it } from 'vitest'
import { splitInstallments } from './installmentSplit.js'

describe('splitInstallments', () => {
  it('splits an evenly divisible amount into equal parts', () => {
    const parts = splitInstallments(300, 3, new Date('2024-03-10T00:00:00.000Z'))

    expect(parts).toHaveLength(3)
    expect(parts.map((p) => p.amount.toString())).toEqual(['100', '100', '100'])
    expect(parts.map((p) => p.installmentNumber)).toEqual([1, 2, 3])
  })

  it('puts the rounding residual on the last installment', () => {
    const parts = splitInstallments(100, 3, new Date('2024-01-01T00:00:00.000Z'))

    // 100 / 3 = 33.333... -> floor to 33.33 for the first two, residual on the last
    expect(parts.map((p) => p.amount.toString())).toEqual(['33.33', '33.33', '33.34'])
    const sum = parts.reduce((acc, p) => acc.plus(p.amount), parts[0]!.amount.minus(parts[0]!.amount))
    expect(sum.toString()).toBe('100')
  })

  it('generates dates one month apart, same day of month', () => {
    const parts = splitInstallments(300, 3, new Date('2024-03-10T00:00:00.000Z'))

    expect(parts.map((p) => p.date.toISOString().slice(0, 10))).toEqual([
      '2024-03-10',
      '2024-04-10',
      '2024-05-10',
    ])
  })

  it('supports the minimum of 2 installments', () => {
    const parts = splitInstallments(10, 2, new Date('2024-01-01T00:00:00.000Z'))
    expect(parts.map((p) => p.amount.toString())).toEqual(['5', '5'])
  })
})
