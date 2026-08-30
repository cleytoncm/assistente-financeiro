import { useState, type FormEvent } from 'react'
import type { Account } from '../accounts/accountsApi'
import { payPayable, cancelPayable, deletePayable, type Payable } from './payablesApi'
import { ApiError } from '../lib/httpClient'

const STATUS_LABELS: Record<Payable['status'], string> = {
  pendente: 'Pendente',
  vence_hoje: 'Vence hoje',
  atrasada: 'Atrasada',
  paga: 'Paga',
  cancelada: 'Cancelada',
}

type DeleteConfirmation = { amount: string; date: string } | null

export function PayableRow({
  payable,
  accounts,
  onChanged,
}: {
  payable: Payable
  accounts: Account[]
  onChanged: () => void
}) {
  const [isPaying, setIsPaying] = useState(false)
  const [paymentAccountId, setPaymentAccountId] = useState(payable.accountId ?? '')
  const [paidAmount, setPaidAmount] = useState(payable.amount)

  const [isCancelling, setIsCancelling] = useState(false)
  const [cancellationReason, setCancellationReason] = useState('')
  const [cancelConfirmation, setCancelConfirmation] = useState<DeleteConfirmation>(null)

  const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteConfirmation>(null)
  const [error, setError] = useState<string | null>(null)

  const isFinal = payable.status === 'paga' || payable.status === 'cancelada'

  async function handlePay(event: FormEvent) {
    event.preventDefault()
    setError(null)
    try {
      await payPayable(payable.id, { accountId: paymentAccountId, paidAmount: Number(paidAmount) })
      setIsPaying(false)
      onChanged()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao registrar pagamento.')
    }
  }

  async function handleCancel(confirmDeleteTransaction = false) {
    setError(null)
    try {
      await cancelPayable(payable.id, { cancellationReason: cancellationReason || undefined, confirmDeleteTransaction })
      setIsCancelling(false)
      setCancelConfirmation(null)
      onChanged()
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const data = err.data as { deleteTransaction?: { amount: string; date: string } } | null
        if (data?.deleteTransaction) {
          setCancelConfirmation({ amount: data.deleteTransaction.amount, date: data.deleteTransaction.date })
          return
        }
      }
      setError(err instanceof ApiError ? err.message : 'Erro ao cancelar.')
    }
  }

  async function handleDelete(confirmDeleteTransaction = false) {
    setError(null)
    try {
      await deletePayable(payable.id, confirmDeleteTransaction)
      onChanged()
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const data = err.data as { deleteTransaction?: { amount: string; date: string } } | null
        if (data?.deleteTransaction) {
          setDeleteConfirmation({ amount: data.deleteTransaction.amount, date: data.deleteTransaction.date })
          return
        }
      }
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir.')
    }
  }

  return (
    <li>
      {payable.dueDate.slice(0, 10)} — {payable.description ?? 'Sem descrição'} —{' '}
      {payable.type === 'expense' ? '-' : '+'}
      {payable.amount} — {STATUS_LABELS[payable.status]}
      {payable.counterparty && ` — ${payable.counterparty}`}
      {payable.installmentNumber && ` — parcela ${payable.installmentNumber}`}
      {payable.cancellationReason && ` — motivo: ${payable.cancellationReason}`}
      {!isFinal && (
        <button type="button" onClick={() => setIsPaying((v) => !v)}>
          Pagar
        </button>
      )}
      {payable.status !== 'cancelada' && (
        <button type="button" onClick={() => setIsCancelling((v) => !v)}>
          Cancelar
        </button>
      )}
      <button type="button" onClick={() => handleDelete(false)}>
        Excluir
      </button>
      {error && <p role="alert">{error}</p>}
      {isPaying && (
        <form onSubmit={handlePay} aria-label={`Pagar ${payable.description ?? payable.id}`}>
          <label htmlFor={`payable-account-${payable.id}`}>Conta</label>
          <select
            id={`payable-account-${payable.id}`}
            value={paymentAccountId}
            onChange={(e) => setPaymentAccountId(e.target.value)}
            required
          >
            <option value="">Selecione...</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
          <label htmlFor={`payable-paid-amount-${payable.id}`}>Valor pago</label>
          <input
            id={`payable-paid-amount-${payable.id}`}
            type="number"
            step="0.01"
            value={paidAmount}
            onChange={(e) => setPaidAmount(e.target.value)}
          />
          <button type="submit">Confirmar pagamento</button>
        </form>
      )}
      {isCancelling && !cancelConfirmation && (
        <div>
          <label htmlFor={`payable-cancel-reason-${payable.id}`}>Motivo (opcional)</label>
          <input
            id={`payable-cancel-reason-${payable.id}`}
            value={cancellationReason}
            onChange={(e) => setCancellationReason(e.target.value)}
          />
          <button type="button" onClick={() => handleCancel(false)}>
            Confirmar cancelamento
          </button>
        </div>
      )}
      {cancelConfirmation && (
        <section role="alertdialog" aria-label="Confirmar cancelamento de parcela paga">
          <p>
            Esta parcela já está paga (transação de {cancelConfirmation.amount} em{' '}
            {cancelConfirmation.date.slice(0, 10)}). Cancelar também removerá essa transação. Deseja continuar?
          </p>
          <button type="button" onClick={() => handleCancel(true)}>
            Confirmar
          </button>
          <button type="button" onClick={() => setCancelConfirmation(null)}>
            Voltar
          </button>
        </section>
      )}
      {deleteConfirmation && (
        <section role="alertdialog" aria-label="Confirmar exclusão de parcela paga">
          <p>
            Esta parcela já está paga (transação de {deleteConfirmation.amount} em{' '}
            {deleteConfirmation.date.slice(0, 10)}). Excluir também removerá essa transação. Deseja continuar?
          </p>
          <button type="button" onClick={() => handleDelete(true)}>
            Confirmar exclusão
          </button>
          <button type="button" onClick={() => setDeleteConfirmation(null)}>
            Voltar
          </button>
        </section>
      )}
    </li>
  )
}
