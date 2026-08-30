import { describe, expect, it } from 'vitest'
import { computePayableStatus } from './payableStatus.js'

const today = new Date('2024-06-15T00:00:00.000Z')

function payable(overrides: Partial<Parameters<typeof computePayableStatus>[0]> = {}) {
  return {
    dueDate: today,
    paidTransactionId: null,
    cancelledAt: null,
    ...overrides,
  }
}

describe('computePayableStatus', () => {
  it('is pendente when due in the future, unpaid, uncancelled', () => {
    expect(computePayableStatus(payable({ dueDate: new Date('2024-06-16T00:00:00.000Z') }), today)).toBe('pendente')
  })

  it('is vence_hoje when due date equals today', () => {
    expect(computePayableStatus(payable({ dueDate: today }), today)).toBe('vence_hoje')
  })

  it('is atrasada when due in the past, unpaid, uncancelled', () => {
    expect(computePayableStatus(payable({ dueDate: new Date('2024-06-14T00:00:00.000Z') }), today)).toBe('atrasada')
  })

  it('is paga when it has a paid transaction, regardless of date', () => {
    expect(
      computePayableStatus(
        payable({ dueDate: new Date('2024-06-14T00:00:00.000Z'), paidTransactionId: 'txn-1' }),
        today
      )
    ).toBe('paga')
  })

  it('is cancelada when cancelled, regardless of date or payment', () => {
    expect(
      computePayableStatus(
        payable({ dueDate: new Date('2024-06-14T00:00:00.000Z'), cancelledAt: new Date() }),
        today
      )
    ).toBe('cancelada')
  })

  it('prioritizes cancelada over paga when somehow both are set', () => {
    expect(
      computePayableStatus(payable({ paidTransactionId: 'txn-1', cancelledAt: new Date() }), today)
    ).toBe('cancelada')
  })
})
