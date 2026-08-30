import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
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
import { formatCurrency } from '../lib/currency'
import {
  PageHeader,
  Card as UiCard,
  Input,
  Select,
  Button,
  Badge,
  Alert,
  ItemList,
  ItemRow,
} from '../components/ui'

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
    <ItemRow className="flex-col items-stretch gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-500 dark:text-slate-400">{row.date.slice(0, 10)}</span>
        {isPending ? (
          <Input
            aria-label={`Descrição de ${row.description}`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="max-w-xs"
          />
        ) : (
          <span className="font-medium text-slate-900 dark:text-slate-50">{row.description}</span>
        )}
        {isPending ? (
          <Input
            aria-label={`Valor de ${row.description}`}
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="max-w-28"
          />
        ) : (
          <span
            className={
              row.type === 'expense'
                ? 'font-semibold tabular-nums text-red-600 dark:text-red-400'
                : 'font-semibold tabular-nums text-emerald-600 dark:text-emerald-400'
            }
          >
            {row.type === 'expense' ? '-' : '+'}
            {formatCurrency(row.amount)}
          </span>
        )}
        {isPending && (
          <Select
            aria-label={`Tipo de ${row.description}`}
            value={type}
            onChange={(e) => setType(e.target.value as 'income' | 'expense')}
            className="w-auto"
          >
            <option value="expense">Despesa</option>
            <option value="income">Receita</option>
          </Select>
        )}
        {isPending && (
          <Select
            aria-label={`Categoria de ${row.description}`}
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-auto"
          >
            <option value="">Sem categoria</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        )}
        {row.isDuplicateSuspect && <Badge tone="amber">possível duplicata</Badge>}
        {!isPending && <Badge tone="slate">{row.resolution}</Badge>}
      </div>
      {isPending && (
        <div className="flex gap-2">
          <Button size="sm" variant="primary" onClick={handleSave}>
            Salvar
          </Button>
          <Button size="sm" onClick={handleDiscard}>
            Descartar
          </Button>
        </div>
      )}
      {error && <Alert>{error}</Alert>}
    </ItemRow>
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
      <div>
        <p className="text-sm text-slate-500 dark:text-slate-400">Carregando...</p>
      </div>
    )
  }

  const acceptedCount = rows.filter((r) => r.resolution === 'aceita').length
  const pendingRows = rows.filter((r) => r.resolution === 'pendente')

  return (
    <div className="space-y-6">
      <PageHeader backTo="/importacoes" title={`Importação ${FORMAT_LABELS[batch.format]}`} />

      {batch.status === 'processando' && (
        <UiCard>
          <p className="text-sm text-slate-600 dark:text-slate-400">Processando arquivo...</p>
        </UiCard>
      )}

      {batch.status === 'falhou' && (
        <Alert>
          Não foi possível processar o arquivo: {batch.errorMessage}. Tente exportar em outro formato.
        </Alert>
      )}

      {(batch.status === 'aguardando_revisao' || batch.status === 'concluido') && (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {acceptedCount} lançamento(s) já aceito(s) automaticamente.
        </p>
      )}

      {batch.status === 'aguardando_revisao' && (
        <section>
          <h2 className="mb-3">Revisão</h2>
          <ItemList className="mb-4">
            {pendingRows.map((row) => (
              <ImportedRowEditor key={row.id} row={row} categories={categories} onChanged={() => load(batch.id)} />
            ))}
          </ItemList>
          <Button variant="primary" onClick={handleConfirm}>
            Confirmar importação
          </Button>
          {confirmError && <Alert className="mt-3">{confirmError}</Alert>}
        </section>
      )}

      {batch.status === 'concluido' && (
        <UiCard>
          <p className="text-sm text-emerald-700 dark:text-emerald-400">Importação concluída.</p>
        </UiCard>
      )}
    </div>
  )
}
