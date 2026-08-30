import { useEffect, useState, type ComponentProps } from 'react'
import { Link } from 'react-router-dom'
import { listAccounts, type Account } from '../accounts/accountsApi'
import { listCards, type Card } from '../cards/cardsApi'
import { listImportBatches, type ImportBatch } from '../imports/importsApi'
import { PageHeader, buttonClasses, Badge, ItemList, ItemRow, EmptyState } from '../components/ui'

const FORMAT_LABELS: Record<ImportBatch['format'], string> = {
  ofx: 'OFX',
  csv: 'CSV',
  pdf_invoice: 'PDF de fatura',
}

const STATUS_LABELS: Record<ImportBatch['status'], string> = {
  processando: 'Processando',
  aguardando_revisao: 'Aguardando revisão',
  concluido: 'Concluído',
  falhou: 'Falhou',
}

const STATUS_TONES: Record<ImportBatch['status'], ComponentProps<typeof Badge>['tone']> = {
  processando: 'blue',
  aguardando_revisao: 'amber',
  concluido: 'green',
  falhou: 'red',
}

export function ImportHistoryPage() {
  const [batches, setBatches] = useState<ImportBatch[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [loaded, setLoaded] = useState(false)

  async function loadAll() {
    const [batchList, accountList, cardList] = await Promise.all([
      listImportBatches(),
      listAccounts({ includeHidden: true }),
      listCards({ includeHidden: true }),
    ])
    setBatches(batchList)
    setAccounts(accountList)
    setCards(cardList)
    setLoaded(true)
  }

  useEffect(() => {
    void loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function destinationName(batch: ImportBatch): string {
    if (batch.accountId) return accounts.find((a) => a.id === batch.accountId)?.name ?? 'Conta removida'
    return cards.find((c) => c.id === batch.cardId)?.name ?? 'Cartão removido'
  }

  return (
    <div>
      <PageHeader
        backTo="/"
        title="Importações"
        actions={
          <Link to="/importacoes/nova" className={buttonClasses('primary')}>
            Nova importação
          </Link>
        }
      />

      {loaded && batches.length === 0 ? (
        <EmptyState>Nenhuma importação realizada ainda.</EmptyState>
      ) : (
        <ItemList>
          {batches.map((batch) => (
            <ItemRow key={batch.id}>
              <Link
                to={`/importacoes/${batch.id}`}
                className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
              >
                {batch.createdAt.slice(0, 10)} — {FORMAT_LABELS[batch.format]} — {destinationName(batch)}
              </Link>
              <Badge tone={STATUS_TONES[batch.status]}>{STATUS_LABELS[batch.status]}</Badge>
            </ItemRow>
          ))}
        </ItemList>
      )}
    </div>
  )
}
