import { useEffect, useState } from 'react'
import { listAccounts, type Account } from '../accounts/accountsApi'
import { listCards, type Card } from '../cards/cardsApi'
import { listCategories, type Category } from '../categories/categoriesApi'
import { listTransactions, type Transaction } from '../transactions/transactionsApi'
import { TransactionForm } from '../transactions/TransactionForm'
import { TransactionRow } from '../transactions/TransactionRow'
import { PageHeader, Card as UiCard, Field, Select, Input, Button, ItemList, EmptyState } from '../components/ui'

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
    <div className="space-y-6">
      <PageHeader backTo="/" title="Extrato" />

      <UiCard>
        <TransactionForm onCreated={handleCreated} />
      </UiCard>

      <UiCard>
        <h2 className="mb-3">Filtros</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <Field label="Conta" htmlFor="filter-account">
            <Select
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
            </Select>
          </Field>

          <Field label="Cartão" htmlFor="filter-card">
            <Select
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
            </Select>
          </Field>

          <Field label="Categoria" htmlFor="filter-category">
            <Select
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
            </Select>
          </Field>

          <Field label="De" htmlFor="filter-from">
            <Input
              id="filter-from"
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value)
                setOffset(0)
              }}
            />
          </Field>

          <Field label="Até" htmlFor="filter-to">
            <Input
              id="filter-to"
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value)
                setOffset(0)
              }}
            />
          </Field>
        </div>
      </UiCard>

      <section>
        <h2 className="mb-3">Lançamentos</h2>
        {items.length === 0 ? (
          <EmptyState>Nenhum lançamento encontrado.</EmptyState>
        ) : (
          <ItemList>
            {items.map((transaction) => (
              <TransactionRow
                key={transaction.id}
                transaction={transaction}
                categories={categories}
                onChanged={loadTransactions}
              />
            ))}
          </ItemList>
        )}
        <div className="mt-3 flex gap-2">
          <Button type="button" disabled={!hasPrevPage} onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}>
            Anterior
          </Button>
          <Button type="button" disabled={!hasNextPage} onClick={() => setOffset((o) => o + PAGE_SIZE)}>
            Próxima
          </Button>
        </div>
      </section>
    </div>
  )
}
