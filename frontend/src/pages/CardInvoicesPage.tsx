import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { listCards, type Card } from '../cards/cardsApi'
import { listInvoicesForCard, type Invoice } from '../invoices/invoicesApi'
import { PageHeader, ItemList, ItemRow, Badge, EmptyState } from '../components/ui'
import type { ComponentProps } from 'react'

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
    <div>
      <PageHeader backTo="/contas" title={`Faturas ${card ? `— ${card.name}` : ''}`} />

      {loaded && invoices.length === 0 ? (
        <EmptyState>Nenhuma fatura encontrada.</EmptyState>
      ) : (
        <ItemList>
          {invoices.map((invoice) => (
            <ItemRow key={invoice.id}>
              <Link
                to={`/faturas/${invoice.id}`}
                className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
              >
                {String(invoice.periodMonth).padStart(2, '0')}/{invoice.periodYear}
              </Link>
              <div className="flex items-center gap-3">
                <Badge tone={STATUS_TONES[invoice.status]}>{STATUS_LABELS[invoice.status]}</Badge>
                <span className="text-sm text-slate-500 dark:text-slate-400">total {invoice.total}</span>
              </div>
            </ItemRow>
          ))}
        </ItemList>
      )}
    </div>
  )
}
