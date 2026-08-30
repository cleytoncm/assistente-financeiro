import { useState, type FormEvent } from 'react'
import type { Account } from '../accounts/accountsApi'
import { createCard, type Card } from './cardsApi'
import { ApiError } from '../lib/httpClient'

export function CardForm({
  accounts,
  onCreated,
}: {
  accounts: Account[]
  onCreated: (card: Card) => void
}) {
  const [name, setName] = useState('')
  const [creditLimit, setCreditLimit] = useState('')
  const [closingDay, setClosingDay] = useState('1')
  const [dueDay, setDueDay] = useState('10')
  const [linkedAccountId, setLinkedAccountId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const card = await createCard({
        name,
        creditLimit: Number(creditLimit),
        closingDay: Number(closingDay),
        dueDay: Number(dueDay),
        linkedAccountId: linkedAccountId || undefined,
      })
      onCreated(card)
      setName('')
      setCreditLimit('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao criar cartão.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-label="Novo cartão">
      <label htmlFor="card-name">Nome do cartão</label>
      <input id="card-name" value={name} onChange={(e) => setName(e.target.value)} required />

      <label htmlFor="card-limit">Limite</label>
      <input
        id="card-limit"
        type="number"
        step="0.01"
        value={creditLimit}
        onChange={(e) => setCreditLimit(e.target.value)}
        required
      />

      <label htmlFor="card-closing-day">Dia de fechamento</label>
      <input
        id="card-closing-day"
        type="number"
        min={1}
        max={31}
        value={closingDay}
        onChange={(e) => setClosingDay(e.target.value)}
        required
      />

      <label htmlFor="card-due-day">Dia de vencimento</label>
      <input
        id="card-due-day"
        type="number"
        min={1}
        max={31}
        value={dueDay}
        onChange={(e) => setDueDay(e.target.value)}
        required
      />

      <label htmlFor="card-linked-account">Conta vinculada (opcional)</label>
      <select
        id="card-linked-account"
        value={linkedAccountId}
        onChange={(e) => setLinkedAccountId(e.target.value)}
      >
        <option value="">Sem vínculo</option>
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.name}
          </option>
        ))}
      </select>

      {error && <p role="alert">{error}</p>}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Criando...' : 'Criar cartão'}
      </button>
    </form>
  )
}
