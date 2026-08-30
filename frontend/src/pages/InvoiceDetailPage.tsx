import { useEffect, useState, type ComponentProps, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { listAccounts, type Account } from '../accounts/accountsApi'
import { listCards, type Card } from '../cards/cardsApi'
import { getInvoice, getInvoiceTransactions, updateInvoice, payInvoice, type Invoice } from '../invoices/invoicesApi'
import type { Transaction } from '../transactions/transactionsApi'
import { ApiError } from '../lib/httpClient'
import {
  PageHeader,
  Card as UiCard,
  Field,
  Input,
  Select,
  Button,
  Badge,
  Alert,
  ItemList,
  ItemRow,
  EmptyState,
} from '../components/ui'

const STATUS_LABELS: Record<Invoice['status'], string> = {
  aberta: 'Aberta',
  fechada: 'Fechada',
  atrasada: 'Atrasada',
  paga: 'Paga',
}

const STATUS_TONES: Record<Invoice['status'], ComponentProps<typeof Badge>['tone']> = {
  aberta: 'blue',
  fechada: 'amber',
  atrasada: 'red',
  paga: 'green',
}

export function InvoiceDetailPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [card, setCard] = useState<Card | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])

  const [closingDate, setClosingDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [datesError, setDatesError] = useState<string | null>(null)

  const [paymentAccountId, setPaymentAccountId] = useState('')
  const [payError, setPayError] = useState<string | null>(null)
  const [isPaying, setIsPaying] = useState(false)

  async function load(id: string) {
    const [inv, { items }, accountList] = await Promise.all([
      getInvoice(id),
      getInvoiceTransactions(id),
      listAccounts(),
    ])
    setInvoice(inv)
    setTransactions(items)
    setAccounts(accountList)
    setClosingDate(inv.closingDate.slice(0, 10))
    setDueDate(inv.dueDate.slice(0, 10))

    const cards = await listCards({ includeHidden: true })
    const foundCard = cards.find((c) => c.id === inv.cardId) ?? null
    setCard(foundCard)
    setPaymentAccountId(foundCard?.linkedAccountId ?? '')
  }

  useEffect(() => {
    if (!invoiceId) return
    void load(invoiceId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId])

  async function handleSaveDates() {
    if (!invoice) return
    setDatesError(null)
    try {
      const updated = await updateInvoice(invoice.id, { closingDate, dueDate })
      setInvoice(updated)
    } catch (err) {
      setDatesError(err instanceof ApiError ? err.message : 'Erro ao salvar datas.')
    }
  }

  async function handlePay(event: FormEvent) {
    event.preventDefault()
    if (!invoice || !paymentAccountId) return
    setPayError(null)
    setIsPaying(true)
    try {
      const updated = await payInvoice(invoice.id, { accountId: paymentAccountId })
      setInvoice(updated)
    } catch (err) {
      setPayError(err instanceof ApiError ? err.message : 'Erro ao pagar fatura.')
    } finally {
      setIsPaying(false)
    }
  }

  if (!invoice) {
    return (
      <div>
        <p className="text-sm text-slate-500 dark:text-slate-400">Carregando...</p>
      </div>
    )
  }

  const isPaid = invoice.status === 'paga'

  return (
    <div className="space-y-6">
      <PageHeader
        backTo={card ? `/cartoes/${card.id}/faturas` : undefined}
        title={`Fatura ${String(invoice.periodMonth).padStart(2, '0')}/${invoice.periodYear}`}
      />

      <UiCard className="flex flex-wrap items-center gap-3">
        <Badge tone={STATUS_TONES[invoice.status]}>{STATUS_LABELS[invoice.status]}</Badge>
        <span className="text-sm text-slate-600 dark:text-slate-400">Total: {invoice.total}</span>
      </UiCard>

      <UiCard>
        <h2 className="mb-3">Datas</h2>
        <div className="flex flex-wrap items-end gap-4">
          <Field label="Fechamento" htmlFor="invoice-closing-date">
            <Input
              id="invoice-closing-date"
              type="date"
              value={closingDate}
              disabled={isPaid}
              onChange={(e) => setClosingDate(e.target.value)}
            />
          </Field>
          <Field label="Vencimento" htmlFor="invoice-due-date">
            <Input
              id="invoice-due-date"
              type="date"
              value={dueDate}
              disabled={isPaid}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </Field>
          {!isPaid && (
            <Button type="button" onClick={handleSaveDates}>
              Salvar datas
            </Button>
          )}
        </div>
        {datesError && <Alert className="mt-3">{datesError}</Alert>}
      </UiCard>

      <UiCard>
        <h2 className="mb-3">Pagamento</h2>
        {isPaid ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">Fatura paga.</p>
        ) : (
          <form onSubmit={handlePay} aria-label="Pagar fatura" className="flex flex-wrap items-end gap-4">
            <Field label="Conta pagadora" htmlFor="invoice-payment-account">
              <Select
                id="invoice-payment-account"
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
            <Button type="submit" variant="primary" disabled={isPaying}>
              {isPaying ? 'Pagando...' : `Pagar fatura (${invoice.total})`}
            </Button>
            {payError && <Alert>{payError}</Alert>}
          </form>
        )}
      </UiCard>

      <section>
        <h2 className="mb-3">Lançamentos</h2>
        {transactions.length === 0 ? (
          <EmptyState>Nenhum lançamento nesta fatura.</EmptyState>
        ) : (
          <ItemList>
            {transactions.map((transaction) => (
              <ItemRow key={transaction.id}>
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-50">{transaction.description}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{transaction.date.slice(0, 10)}</p>
                </div>
                <span
                  className={
                    transaction.type === 'expense'
                      ? 'font-semibold tabular-nums text-red-600 dark:text-red-400'
                      : 'font-semibold tabular-nums text-emerald-600 dark:text-emerald-400'
                  }
                >
                  {transaction.type === 'expense' ? '-' : '+'}
                  {transaction.amount}
                </span>
              </ItemRow>
            ))}
          </ItemList>
        )}
      </section>
    </div>
  )
}
