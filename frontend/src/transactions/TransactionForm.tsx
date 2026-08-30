import { useEffect, useState, type FormEvent } from 'react'
import { listAccounts, type Account } from '../accounts/accountsApi'
import { listCards, type Card } from '../cards/cardsApi'
import { listCategories, type Category } from '../categories/categoriesApi'
import { createTransaction, type CreateTransactionInput, type InvoicePaymentAdjustment } from './transactionsApi'
import { ApiError } from '../lib/httpClient'
import { Field, Input, Select, Button, Alert, ConfirmPanel } from '../components/ui'

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
  const [pendingAdjustment, setPendingAdjustment] = useState<InvoicePaymentAdjustment | null>(null)
  const [pendingInput, setPendingInput] = useState<CreateTransactionInput | null>(null)

  useEffect(() => {
    listAccounts().then(setAccounts).catch(() => {})
    listCards().then(setCards).catch(() => {})
    listCategories().then(setCategories).catch(() => {})
  }, [])

  const isCardDestination = destination.startsWith('card:')
  const filteredCategories = categories.filter((c) => c.type === type)

  async function submit(input: CreateTransactionInput) {
    setIsSubmitting(true)
    try {
      await createTransaction(input)
      onCreated()
      setAmount('')
      setDescription('')
      setInstallments('')
      setPendingAdjustment(null)
      setPendingInput(null)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const adjustment = (err.data as { invoicePaymentAdjustment?: InvoicePaymentAdjustment } | null)
          ?.invoicePaymentAdjustment
        if (adjustment) {
          setPendingAdjustment(adjustment)
          setPendingInput(input)
          return
        }
      }
      setError(err instanceof ApiError ? err.message : 'Erro ao lançar. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    const [destType, destId] = destination.split(':')
    if (!destType || !destId) {
      setError('Escolha uma conta ou cartão.')
      return
    }

    await submit({
      type,
      amount: Number(amount),
      date,
      description,
      categoryId: categoryId || undefined,
      accountId: destType === 'account' ? destId : undefined,
      cardId: destType === 'card' ? destId : undefined,
      installments: isCardDestination && installments ? Number(installments) : undefined,
    })
  }

  async function confirmAdjustment() {
    if (!pendingInput) return
    await submit({ ...pendingInput, confirmPaymentAdjustment: true })
  }

  function cancelAdjustment() {
    setPendingAdjustment(null)
    setPendingInput(null)
  }

  return (
    <form onSubmit={handleSubmit} aria-label="Novo lançamento" className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Field label="Tipo" htmlFor="transaction-type">
          <Select
            id="transaction-type"
            value={type}
            onChange={(e) => {
              setType(e.target.value as 'income' | 'expense')
              setCategoryId('')
            }}
          >
            <option value="expense">Despesa</option>
            <option value="income">Receita</option>
          </Select>
        </Field>

        <Field label={`Valor ${installments ? '(total)' : ''}`} htmlFor="transaction-amount">
          <Input
            id="transaction-amount"
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </Field>

        <Field label="Data" htmlFor="transaction-date">
          <Input id="transaction-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>

        <Field label="Descrição" htmlFor="transaction-description">
          <Input
            id="transaction-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Conta ou cartão" htmlFor="transaction-destination">
          <Select
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
          </Select>
        </Field>

        <Field label="Categoria (opcional)" htmlFor="transaction-category">
          <Select id="transaction-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Sem categoria</option>
            {filteredCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </Field>

        {isCardDestination && (
          <Field label="Parcelar em (opcional)" htmlFor="transaction-installments">
            <Input
              id="transaction-installments"
              type="number"
              min={2}
              value={installments}
              onChange={(e) => setInstallments(e.target.value)}
            />
          </Field>
        )}
      </div>

      {error && <Alert>{error}</Alert>}

      <Button type="submit" variant="primary" disabled={isSubmitting}>
        {isSubmitting ? 'Lançando...' : 'Lançar'}
      </Button>

      {pendingAdjustment && (
        <ConfirmPanel aria-label="Confirmar ajuste de fatura paga">
          <p>
            A fatura desse cartão já está paga. O pagamento de R${pendingAdjustment.oldAmount} será
            atualizado para R${pendingAdjustment.newAmount}. Deseja continuar?
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="primary" onClick={confirmAdjustment} disabled={isSubmitting}>
              Confirmar
            </Button>
            <Button size="sm" variant="ghost" onClick={cancelAdjustment}>
              Cancelar
            </Button>
          </div>
        </ConfirmPanel>
      )}
    </form>
  )
}
