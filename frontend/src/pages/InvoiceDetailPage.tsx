import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { listAccounts, type Account } from '../accounts/accountsApi'
import { listCards, type Card } from '../cards/cardsApi'
import { getInvoice, getInvoiceTransactions, updateInvoice, payInvoice, type Invoice } from '../invoices/invoicesApi'
import type { Transaction } from '../transactions/transactionsApi'
import { ApiError } from '../lib/httpClient'

const STATUS_LABELS: Record<Invoice['status'], string> = {
  aberta: 'Aberta',
  fechada: 'Fechada',
  atrasada: 'Atrasada',
  paga: 'Paga',
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
      <main>
        <p>Carregando...</p>
      </main>
    )
  }

  const isPaid = invoice.status === 'paga'

  return (
    <main>
      <p>{card && <Link to={`/cartoes/${card.id}/faturas`}>Voltar</Link>}</p>
      <h1>
        Fatura {String(invoice.periodMonth).padStart(2, '0')}/{invoice.periodYear}
      </h1>
      <p>
        Status: {STATUS_LABELS[invoice.status]} — Total: {invoice.total}
      </p>

      <section>
        <h2>Datas</h2>
        <label htmlFor="invoice-closing-date">Fechamento</label>
        <input
          id="invoice-closing-date"
          type="date"
          value={closingDate}
          disabled={isPaid}
          onChange={(e) => setClosingDate(e.target.value)}
        />
        <label htmlFor="invoice-due-date">Vencimento</label>
        <input
          id="invoice-due-date"
          type="date"
          value={dueDate}
          disabled={isPaid}
          onChange={(e) => setDueDate(e.target.value)}
        />
        {!isPaid && (
          <button type="button" onClick={handleSaveDates}>
            Salvar datas
          </button>
        )}
        {datesError && <p role="alert">{datesError}</p>}
      </section>

      <section>
        <h2>Pagamento</h2>
        {isPaid ? (
          <p>Fatura paga.</p>
        ) : (
          <form onSubmit={handlePay} aria-label="Pagar fatura">
            <label htmlFor="invoice-payment-account">Conta pagadora</label>
            <select
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
            </select>
            <button type="submit" disabled={isPaying}>
              {isPaying ? 'Pagando...' : `Pagar fatura (${invoice.total})`}
            </button>
            {payError && <p role="alert">{payError}</p>}
          </form>
        )}
      </section>

      <section>
        <h2>Lançamentos</h2>
        {transactions.length === 0 && <p>Nenhum lançamento nesta fatura.</p>}
        <ul>
          {transactions.map((transaction) => (
            <li key={transaction.id}>
              {transaction.date.slice(0, 10)} — {transaction.description} —{' '}
              {transaction.type === 'expense' ? '-' : '+'}
              {transaction.amount}
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
