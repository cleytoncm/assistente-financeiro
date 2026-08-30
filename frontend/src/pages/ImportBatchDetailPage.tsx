import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { listCategories, type Category } from '../categories/categoriesApi'
import {
  getImportBatch,
  listImportedRows,
  confirmImportBatch,
  updateImportedRow,
  discardImportedRow,
  type ImportBatch,
  type ImportedRow,
} from '../imports/importsApi'
import { ApiError } from '../lib/httpClient'

const FORMAT_LABELS: Record<ImportBatch['format'], string> = {
  ofx: 'OFX',
  csv: 'CSV',
  pdf_invoice: 'PDF de fatura',
}

function ImportedRowEditor({
  row,
  categories,
  onChanged,
}: {
  row: ImportedRow
  categories: Category[]
  onChanged: () => void
}) {
  const [description, setDescription] = useState(row.description)
  const [amount, setAmount] = useState(row.amount)
  const [type, setType] = useState(row.type)
  const [categoryId, setCategoryId] = useState(row.suggestedCategoryId ?? '')
  const [error, setError] = useState<string | null>(null)

  const isPending = row.resolution === 'pendente'

  async function handleSave() {
    setError(null)
    try {
      await updateImportedRow(row.id, {
        description,
        amount: Number(amount),
        type,
        categoryId: categoryId || null,
      })
      onChanged()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao salvar linha.')
    }
  }

  async function handleDiscard() {
    setError(null)
    try {
      await discardImportedRow(row.id)
      onChanged()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao descartar linha.')
    }
  }

  return (
    <li>
      {row.date.slice(0, 10)} —{' '}
      {isPending ? (
        <input
          aria-label={`Descrição de ${row.description}`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      ) : (
        row.description
      )}{' '}
      —{' '}
      {isPending ? (
        <input
          aria-label={`Valor de ${row.description}`}
          type="number"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      ) : (
        <>
          {row.type === 'expense' ? '-' : '+'}
          {row.amount}
        </>
      )}
      {isPending && (
        <select
          aria-label={`Tipo de ${row.description}`}
          value={type}
          onChange={(e) => setType(e.target.value as 'income' | 'expense')}
        >
          <option value="expense">Despesa</option>
          <option value="income">Receita</option>
        </select>
      )}
      {isPending && (
        <select
          aria-label={`Categoria de ${row.description}`}
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          <option value="">Sem categoria</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      )}
      {row.isDuplicateSuspect && ' — possível duplicata'}
      {!isPending && ` — ${row.resolution}`}
      {isPending && (
        <>
          <button type="button" onClick={handleSave}>
            Salvar
          </button>
          <button type="button" onClick={handleDiscard}>
            Descartar
          </button>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </li>
  )
}

export function ImportBatchDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [batch, setBatch] = useState<ImportBatch | null>(null)
  const [rows, setRows] = useState<ImportedRow[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [confirmError, setConfirmError] = useState<string | null>(null)

  async function load(batchId: string) {
    const [currentBatch, categoryList] = await Promise.all([getImportBatch(batchId), listCategories()])
    setBatch(currentBatch)
    setCategories(categoryList)
    if (currentBatch.status !== 'processando') {
      setRows(await listImportedRows(batchId))
    }
  }

  useEffect(() => {
    if (!id) return
    void load(id)
    const interval = setInterval(() => {
      void load(id)
    }, 1000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function handleConfirm() {
    if (!batch) return
    setConfirmError(null)
    try {
      const updated = await confirmImportBatch(batch.id)
      setBatch(updated)
      setRows(await listImportedRows(batch.id))
    } catch (err) {
      setConfirmError(err instanceof ApiError ? err.message : 'Erro ao confirmar importação.')
    }
  }

  if (!batch) {
    return (
      <main>
        <p>Carregando...</p>
      </main>
    )
  }

  const acceptedCount = rows.filter((r) => r.resolution === 'aceita').length
  const pendingRows = rows.filter((r) => r.resolution === 'pendente')

  return (
    <main>
      <p>
        <Link to="/importacoes">Voltar</Link>
      </p>
      <h1>Importação {FORMAT_LABELS[batch.format]}</h1>

      {batch.status === 'processando' && <p>Processando arquivo...</p>}

      {batch.status === 'falhou' && (
        <p role="alert">
          Não foi possível processar o arquivo: {batch.errorMessage}. Tente exportar em outro formato.
        </p>
      )}

      {(batch.status === 'aguardando_revisao' || batch.status === 'concluido') && (
        <p>{acceptedCount} lançamento(s) já aceito(s) automaticamente.</p>
      )}

      {batch.status === 'aguardando_revisao' && (
        <section>
          <h2>Revisão</h2>
          <ul>
            {pendingRows.map((row) => (
              <ImportedRowEditor
                key={row.id}
                row={row}
                categories={categories}
                onChanged={() => load(batch.id)}
              />
            ))}
          </ul>
          <button type="button" onClick={handleConfirm}>
            Confirmar importação
          </button>
          {confirmError && <p role="alert">{confirmError}</p>}
        </section>
      )}

      {batch.status === 'concluido' && <p>Importação concluída.</p>}
    </main>
  )
}
