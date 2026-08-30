import { useEffect, useState, type FormEvent } from 'react'
import { listAccounts, type Account } from '../accounts/accountsApi'
import { createPayable } from './payablesApi'
import { createPayableGroup } from './payableGroupsApi'
import { ApiError } from '../lib/httpClient'

type Mode = 'avulsa' | 'parcelada' | 'recorrente'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function PayableForm({ onCreated }: { onCreated: () => void }) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [mode, setMode] = useState<Mode>('avulsa')

  const [type, setType] = useState<'income' | 'expense'>('expense')
  const [amount, setAmount] = useState('')
  const [dueDate, setDueDate] = useState(today())
  const [dueDay, setDueDay] = useState('10')
  const [startDate, setStartDate] = useState(today())
  const [installmentCount, setInstallmentCount] = useState('2')
  const [description, setDescription] = useState('')
  const [counterparty, setCounterparty] = useState('')
  const [accountId, setAccountId] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    listAccounts().then(setAccounts).catch(() => {})
  }, [])

  function resetFields() {
    setAmount('')
    setDescription('')
    setCounterparty('')
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      if (mode === 'avulsa') {
        await createPayable({
          type,
          amount: Number(amount),
          dueDate,
          description: description || undefined,
          counterparty: counterparty || undefined,
          accountId: accountId || undefined,
        })
      } else {
        await createPayableGroup({
          type,
          recurrenceType: mode === 'parcelada' ? 'installment' : 'recurring',
          amount: Number(amount),
          dueDay: Number(dueDay),
          startDate,
          installmentCount: mode === 'parcelada' ? Number(installmentCount) : undefined,
          description: description || undefined,
          counterparty: counterparty || undefined,
          accountId: accountId || undefined,
        })
      }
      onCreated()
      resetFields()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao cadastrar. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-label="Nova conta a pagar/receber">
      <label htmlFor="payable-mode">Modo</label>
      <select id="payable-mode" value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
        <option value="avulsa">Avulsa</option>
        <option value="parcelada">Parcelada</option>
        <option value="recorrente">Recorrente</option>
      </select>

      <label htmlFor="payable-type">Tipo</label>
      <select id="payable-type" value={type} onChange={(e) => setType(e.target.value as 'income' | 'expense')}>
        <option value="expense">A pagar</option>
        <option value="income">A receber</option>
      </select>

      <label htmlFor="payable-amount">Valor {mode !== 'avulsa' ? '(por parcela)' : ''}</label>
      <input
        id="payable-amount"
        type="number"
        step="0.01"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        required
      />

      {mode === 'avulsa' ? (
        <>
          <label htmlFor="payable-due-date">Vencimento</label>
          <input
            id="payable-due-date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            required
          />
        </>
      ) : (
        <>
          <label htmlFor="payable-start-date">Primeiro vencimento</label>
          <input
            id="payable-start-date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
          <label htmlFor="payable-due-day">Dia de vencimento</label>
          <input
            id="payable-due-day"
            type="number"
            min={1}
            max={31}
            value={dueDay}
            onChange={(e) => setDueDay(e.target.value)}
            required
          />
        </>
      )}

      {mode === 'parcelada' && (
        <>
          <label htmlFor="payable-installment-count">Quantidade de parcelas</label>
          <input
            id="payable-installment-count"
            type="number"
            min={2}
            value={installmentCount}
            onChange={(e) => setInstallmentCount(e.target.value)}
            required
          />
        </>
      )}

      <label htmlFor="payable-description">Descrição (opcional)</label>
      <input id="payable-description" value={description} onChange={(e) => setDescription(e.target.value)} />

      <label htmlFor="payable-counterparty">Contraparte (opcional)</label>
      <input id="payable-counterparty" value={counterparty} onChange={(e) => setCounterparty(e.target.value)} />

      <label htmlFor="payable-account">Conta sugerida (opcional)</label>
      <select id="payable-account" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
        <option value="">Nenhuma</option>
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.name}
          </option>
        ))}
      </select>

      {error && <p role="alert">{error}</p>}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Cadastrando...' : 'Cadastrar'}
      </button>
    </form>
  )
}
