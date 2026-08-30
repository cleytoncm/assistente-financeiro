import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { listCards, type Card } from '../cards/cardsApi'
import { listInvoicesForCard, type Invoice } from '../invoices/invoicesApi'

const STATUS_LABELS: Record<Invoice['status'], string> = {
  aberta: 'Aberta',
  fechada: 'Fechada',
  atrasada: 'Atrasada',
  paga: 'Paga',
}

export function CardInvoicesPage() {
  const { cardId } = useParams<{ cardId: string }>()
  const [card, setCard] = useState<Card | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loaded, setLoaded] = useState(false)

  async function load(id: string) {
    const [cards, invoiceList] = await Promise.all([listCards({ includeHidden: true }), listInvoicesForCard(id)])
    setCard(cards.find((c) => c.id === id) ?? null)
    setInvoices(invoiceList)
    setLoaded(true)
  }

  useEffect(() => {
    if (!cardId) return
    void load(cardId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId])

  return (
    <main>
      <p>
        <Link to="/contas">Voltar</Link>
      </p>
      <h1>Faturas {card ? `— ${card.name}` : ''}</h1>

      {loaded && invoices.length === 0 && <p>Nenhuma fatura encontrada.</p>}
      <ul>
        {invoices.map((invoice) => (
          <li key={invoice.id}>
            <Link to={`/faturas/${invoice.id}`}>
              {String(invoice.periodMonth).padStart(2, '0')}/{invoice.periodYear}
            </Link>{' '}
            — {STATUS_LABELS[invoice.status]} — total {invoice.total}
          </li>
        ))}
      </ul>
    </main>
  )
}
