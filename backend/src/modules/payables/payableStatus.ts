export type PayableStatus = 'pendente' | 'vence_hoje' | 'atrasada' | 'paga' | 'cancelada'

export type PayableStatusInput = {
  dueDate: Date
  paidTransactionId: string | null
  cancelledAt: Date | null
}

/** Status derivado da parcela (RF-04), calculado a cada leitura, sem coluna persistida. */
export function computePayableStatus(payable: PayableStatusInput, today: Date): PayableStatus {
  if (payable.cancelledAt !== null) return 'cancelada'
  if (payable.paidTransactionId !== null) return 'paga'
  if (payable.dueDate.getTime() < today.getTime()) return 'atrasada'
  if (payable.dueDate.getTime() === today.getTime()) return 'vence_hoje'
  return 'pendente'
}
