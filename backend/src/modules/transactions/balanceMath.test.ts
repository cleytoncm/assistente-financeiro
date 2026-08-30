import { describe, expect, it } from 'vitest'
import { netAmount, computeAvailableLimit } from './balanceMath.js'

describe('netAmount', () => {
  it('computes account balance: initial + income - expense', () => {
    expect(netAmount(100, 50, 30).toString()).toBe('120')
  })

  it('computes card spending: expense - income (a refund reduces spending)', () => {
    expect(netAmount(0, 200, 50).toString()).toBe('150')
  })

  it('handles negative results (account overdrawn)', () => {
    expect(netAmount(0, 10, 50).toString()).toBe('-40')
  })

  it('uses exact decimal arithmetic, avoiding floating point drift', () => {
    expect(netAmount(0, '0.1', '-0.2').toString()).toBe('0.3')
  })
})

describe('computeAvailableLimit', () => {
  it('subtracts current spending from the credit limit', () => {
    expect(computeAvailableLimit(1000, 250).toString()).toBe('750')
  })

  it('can go negative when spending exceeds the limit', () => {
    expect(computeAvailableLimit(1000, 1200).toString()).toBe('-200')
  })
})
