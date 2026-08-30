import { useEffect, useState, type FormEvent } from 'react'
import { listAccounts, type Account } from '../accounts/accountsApi'
import { listCards, type Card } from '../cards/cardsApi'
import { listCategories, type Category } from '../categories/categoriesApi'
import { createTransaction } from './transactionsApi'
import { ApiError } from '../lib/httpClient'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function TransactionForm({ onCreated }: { onCreated: () => void }) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [categories, setCategories] = useState<Category[]>([])

  const [type, setType] = useState<'income' | 'expense'>('expense')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today())
  const [description, setDescription] = useState('')
  const [destination, setDestination] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [installments, setInstallments] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    listAccounts().then(setAccounts).catch(() => {})
    listCards().then(setCards).catch(() => {})
    listCategories().then(setCategories).catch(() => {})
  }, [])

  const isCardDestination = destination.startsWith('card:')
  const filteredCategories = categories.filter((c) => c.type === type)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    const [destType, destId] = destination.split(':')
    if (!destType || !destId) {
      setError('Escolha uma conta ou cartão.')
      return
    }

    setIsSubmitting(true)
    try {
      await createTransaction({
        type,
        amount: Number(amount),
        date,
        description,
        categoryId: categoryId || undefined,
        accountId: destType === 'account' ? destId : undefined,
        cardId: destType === 'card' ? destId : undefined,
        installments: isCardDestination && installments ? Number(installments) : undefined,
      })
      onCreated()
      setAmount('')
      setDescription('')
      setInstallments('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao lançar. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-label="Novo lançamento">
      <label htmlFor="transaction-type">Tipo</label>
      <select
        id="transaction-type"
        value={type}
        onChange={(e) => {
          setType(e.target.value as 'income' | 'expense')
          setCategoryId('')
        }}
      >
        <option value="expense">Despesa</option>
        <option value="income">Receita</option>
      </select>

      <label htmlFor="transaction-amount">Valor {installments ? '(total)' : ''}</label>
      <input
        id="transaction-amount"
        type="number"
        step="0.01"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        required
      />

      <label htmlFor="transaction-date">Data</label>
      <input id="transaction-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />

      <label htmlFor="transaction-description">Descrição</label>
      <input
        id="transaction-description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        required
      />

      <label htmlFor="transaction-destination">Conta ou cartão</label>
      <select
        id="transaction-destination"
        value={destination}
        onChange={(e) => {
          setDestination(e.target.value)
          setInstallments('')
        }}
        required
      >
        <option value="">Selecione...</option>
        <optgroup label="Contas">
          {accounts.map((account) => (
            <option key={account.id} value={`account:${account.id}`}>
              {account.name}
            </option>
          ))}
        </optgroup>
        <optgroup label="Cartões">
          {cards.map((card) => (
            <option key={card.id} value={`card:${card.id}`}>
              {card.name}
            </option>
          ))}
        </optgroup>
      </select>

      <label htmlFor="transaction-category">Categoria (opcional)</label>
      <select id="transaction-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
        <option value="">Sem categoria</option>
        {filteredCategories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>

      {isCardDestination && (
        <>
          <label htmlFor="transaction-installments">Parcelar em (opcional)</label>
          <input
            id="transaction-installments"
            type="number"
            min={2}
            value={installments}
            onChange={(e) => setInstallments(e.target.value)}
          />
        </>
      )}

      {error && <p role="alert">{error}</p>}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Lançando...' : 'Lançar'}
      </button>
    </form>
  )
}
