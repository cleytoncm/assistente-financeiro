import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listAccounts, type Account } from '../accounts/accountsApi'
import { listCards, type Card } from '../cards/cardsApi'
import { listCategories, type Category } from '../categories/categoriesApi'
import { listTransactions, type Transaction } from '../transactions/transactionsApi'
import { TransactionForm } from '../transactions/TransactionForm'
import { TransactionRow } from '../transactions/TransactionRow'

const PAGE_SIZE = 10

export function TransactionsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<Transaction[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)

  const [accountId, setAccountId] = useState('')
  const [cardId, setCardId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  useEffect(() => {
    listAccounts().then(setAccounts).catch(() => {})
    listCards().then(setCards).catch(() => {})
    listCategories().then(setCategories).catch(() => {})
  }, [])

  useEffect(() => {
    void loadTransactions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, cardId, categoryId, from, to, offset])

  async function loadTransactions() {
    const result = await listTransactions({
      accountId: accountId || undefined,
      cardId: cardId || undefined,
      categoryId: categoryId || undefined,
      from: from || undefined,
      to: to || undefined,
      limit: PAGE_SIZE,
      offset,
    })
    setItems(result.items)
    setTotal(result.total)
  }

  function handleCreated() {
    setOffset(0)
    void loadTransactions()
  }

  const hasNextPage = offset + PAGE_SIZE < total
  const hasPrevPage = offset > 0

  return (
    <main>
      <p>
        <Link to="/">Voltar</Link>
      </p>
      <h1>Extrato</h1>

      <TransactionForm onCreated={handleCreated} />

      <section>
        <h2>Filtros</h2>
        <label htmlFor="filter-account">Conta</label>
        <select
          id="filter-account"
          value={accountId}
          onChange={(e) => {
            setAccountId(e.target.value)
            setCardId('')
            setOffset(0)
          }}
        >
          <option value="">Todas</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>

        <label htmlFor="filter-card">Cartão</label>
        <select
          id="filter-card"
          value={cardId}
          onChange={(e) => {
            setCardId(e.target.value)
            setAccountId('')
            setOffset(0)
          }}
        >
          <option value="">Todos</option>
          {cards.map((card) => (
            <option key={card.id} value={card.id}>
              {card.name}
            </option>
          ))}
        </select>

        <label htmlFor="filter-category">Categoria</label>
        <select
          id="filter-category"
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value)
            setOffset(0)
          }}
        >
          <option value="">Todas</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>

        <label htmlFor="filter-from">De</label>
        <input
          id="filter-from"
          type="date"
          value={from}
          onChange={(e) => {
            setFrom(e.target.value)
            setOffset(0)
          }}
        />

        <label htmlFor="filter-to">Até</label>
        <input
          id="filter-to"
          type="date"
          value={to}
          onChange={(e) => {
            setTo(e.target.value)
            setOffset(0)
          }}
        />
      </section>

      <section>
        <h2>Lançamentos</h2>
        {items.length === 0 && <p>Nenhum lançamento encontrado.</p>}
        <ul>
          {items.map((transaction) => (
            <TransactionRow
              key={transaction.id}
              transaction={transaction}
              categories={categories}
              onChanged={loadTransactions}
            />
          ))}
        </ul>
        <button type="button" disabled={!hasPrevPage} onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}>
          Anterior
        </button>
        <button type="button" disabled={!hasNextPage} onClick={() => setOffset((o) => o + PAGE_SIZE)}>
          Próxima
        </button>
      </section>
    </main>
  )
}
