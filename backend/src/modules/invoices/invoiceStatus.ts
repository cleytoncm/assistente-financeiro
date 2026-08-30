export type InvoiceStatus = 'aberta' | 'fechada' | 'atrasada' | 'paga'

/**
 * Derived on every read, never persisted (RF-03) — mirrors the same "computed, not stored"
 * pattern already used for account/card balances (Etapa 3).
 */
export function computeInvoiceStatus(
  invoice: { paidAt: Date | null; closingDate: Date; dueDate: Date },
  today: Date
): InvoiceStatus {
  if (invoice.paidAt !== null) return 'paga'
  if (today > invoice.dueDate) return 'atrasada'
  if (today > invoice.closingDate) return 'fechada'
  return 'aberta'
}
