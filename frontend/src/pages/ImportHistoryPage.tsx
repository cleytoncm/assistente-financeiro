import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listAccounts, type Account } from '../accounts/accountsApi'
import { listCards, type Card } from '../cards/cardsApi'
import { listImportBatches, type ImportBatch } from '../imports/importsApi'

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
    <main>
      <p>
        <Link to="/">Voltar</Link>
      </p>
      <h1>Importações</h1>
      <p>
        <Link to="/importacoes/nova">Nova importação</Link>
      </p>

      {loaded && batches.length === 0 && <p>Nenhuma importação realizada ainda.</p>}
      <ul>
        {batches.map((batch) => (
          <li key={batch.id}>
            <Link to={`/importacoes/${batch.id}`}>
              {batch.createdAt.slice(0, 10)} — {FORMAT_LABELS[batch.format]} — {destinationName(batch)}
            </Link>{' '}
            — {STATUS_LABELS[batch.status]}
          </li>
        ))}
      </ul>
    </main>
  )
}
