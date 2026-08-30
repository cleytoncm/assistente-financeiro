import { useState, type ComponentProps, type FormEvent } from 'react'
import type { Account } from '../accounts/accountsApi'
import { payPayable, cancelPayable, deletePayable, type Payable } from './payablesApi'
import { ApiError } from '../lib/httpClient'
import { ItemRow, Field, Input, Select, Button, Badge, Alert, ConfirmPanel } from '../components/ui'

const STATUS_LABELS: Record<Payable['status'], string> = {
  pendente: 'Pendente',
  vence_hoje: 'Vence hoje',
  atrasada: 'Atrasada',
  paga: 'Paga',
  cancelada: 'Cancelada',
}

const STATUS_TONES: Record<Payable['status'], ComponentProps<typeof Badge>['tone']> = {
  pendente: 'slate',
  vence_hoje: 'amber',
  atrasada: 'red',
  paga: 'green',
  cancelada: 'slate',
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
    <ItemRow className="flex-col items-stretch gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium text-slate-900 dark:text-slate-50">
            {payable.description ?? 'Sem descrição'}
            {payable.installmentNumber && (
              <Badge tone="slate" className="ml-2">
                parcela {payable.installmentNumber}
              </Badge>
            )}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {payable.dueDate.slice(0, 10)}
            {payable.counterparty && ` — ${payable.counterparty}`}
            {payable.cancellationReason && ` — motivo: ${payable.cancellationReason}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge tone={STATUS_TONES[payable.status]}>{STATUS_LABELS[payable.status]}</Badge>
          <span
            className={
              payable.type === 'expense'
                ? 'font-semibold tabular-nums text-red-600 dark:text-red-400'
                : 'font-semibold tabular-nums text-emerald-600 dark:text-emerald-400'
            }
          >
            {payable.type === 'expense' ? '-' : '+'}
            {payable.amount}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {!isFinal && (
          <Button size="sm" onClick={() => setIsPaying((v) => !v)}>
            Pagar
          </Button>
        )}
        {payable.status !== 'cancelada' && (
          <Button size="sm" onClick={() => setIsCancelling((v) => !v)}>
            Cancelar
          </Button>
        )}
        <Button size="sm" variant="danger" onClick={() => handleDelete(false)}>
          Excluir
        </Button>
      </div>

      {error && <Alert>{error}</Alert>}

      {isPaying && (
        <form
          onSubmit={handlePay}
          aria-label={`Pagar ${payable.description ?? payable.id}`}
          className="flex flex-wrap items-end gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50"
        >
          <Field label="Conta" htmlFor={`payable-account-${payable.id}`}>
            <Select
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
            </Select>
          </Field>
          <Field label="Valor pago" htmlFor={`payable-paid-amount-${payable.id}`}>
            <Input
              id={`payable-paid-amount-${payable.id}`}
              type="number"
              step="0.01"
              value={paidAmount}
              onChange={(e) => setPaidAmount(e.target.value)}
            />
          </Field>
          <Button type="submit" variant="primary" size="sm">
            Confirmar pagamento
          </Button>
        </form>
      )}

      {isCancelling && !cancelConfirmation && (
        <div className="flex flex-wrap items-end gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
          <Field label="Motivo (opcional)" htmlFor={`payable-cancel-reason-${payable.id}`}>
            <Input
              id={`payable-cancel-reason-${payable.id}`}
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
            />
          </Field>
          <Button size="sm" variant="primary" onClick={() => handleCancel(false)}>
            Confirmar cancelamento
          </Button>
        </div>
      )}

      {cancelConfirmation && (
        <ConfirmPanel aria-label="Confirmar cancelamento de parcela paga">
          <p>
            Esta parcela já está paga (transação de {cancelConfirmation.amount} em{' '}
            {cancelConfirmation.date.slice(0, 10)}). Cancelar também removerá essa transação. Deseja continuar?
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="primary" onClick={() => handleCancel(true)}>
              Confirmar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCancelConfirmation(null)}>
              Voltar
            </Button>
          </div>
        </ConfirmPanel>
      )}

      {deleteConfirmation && (
        <ConfirmPanel aria-label="Confirmar exclusão de parcela paga">
          <p>
            Esta parcela já está paga (transação de {deleteConfirmation.amount} em{' '}
            {deleteConfirmation.date.slice(0, 10)}). Excluir também removerá essa transação. Deseja continuar?
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="primary" onClick={() => handleDelete(true)}>
              Confirmar exclusão
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDeleteConfirmation(null)}>
              Voltar
            </Button>
          </div>
        </ConfirmPanel>
      )}
    </ItemRow>
  )
}
