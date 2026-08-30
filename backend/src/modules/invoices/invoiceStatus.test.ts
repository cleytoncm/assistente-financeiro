import { describe, expect, it } from 'vitest'
import { computeInvoiceStatus } from './invoiceStatus.js'

const closingDate = new Date('2024-03-10T00:00:00.000Z')
const dueDate = new Date('2024-03-20T00:00:00.000Z')

describe('computeInvoiceStatus', () => {
  it('is aberta before the closing date', () => {
    const today = new Date('2024-03-05T00:00:00.000Z')
    expect(computeInvoiceStatus({ paidAt: null, closingDate, dueDate }, today)).toBe('aberta')
  })

  it('is aberta on the closing date itself (has not passed yet)', () => {
    expect(computeInvoiceStatus({ paidAt: null, closingDate, dueDate }, closingDate)).toBe('aberta')
  })

  it('is fechada right after the closing date', () => {
    const today = new Date('2024-03-11T00:00:00.000Z')
    expect(computeInvoiceStatus({ paidAt: null, closingDate, dueDate }, today)).toBe('fechada')
  })

  it('is fechada on the due date itself (has not passed yet)', () => {
    expect(computeInvoiceStatus({ paidAt: null, closingDate, dueDate }, dueDate)).toBe('fechada')
  })

  it('is atrasada right after the due date', () => {
    const today = new Date('2024-03-21T00:00:00.000Z')
    expect(computeInvoiceStatus({ paidAt: null, closingDate, dueDate }, today)).toBe('atrasada')
  })

  it('is paga whenever paidAt is set, regardless of today', () => {
    const paidAt = new Date('2024-03-01T00:00:00.000Z')
    const today = new Date('2024-03-21T00:00:00.000Z')
    expect(computeInvoiceStatus({ paidAt, closingDate, dueDate }, today)).toBe('paga')
  })
})
