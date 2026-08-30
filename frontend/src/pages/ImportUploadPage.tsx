import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { listAccounts, type Account } from '../accounts/accountsApi'
import { listCards, type Card } from '../cards/cardsApi'
import { createImportBatch, type ImportFormat, type ImportMode } from '../imports/importsApi'
import { ApiError } from '../lib/httpClient'
import { PageHeader, Card as UiCard, Field, Select, Button, Alert, ConfirmPanel } from '../components/ui'

export function ImportUploadPage() {
  const navigate = useNavigate()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [cards, setCards] = useState<Card[]>([])

  const [format, setFormat] = useState<ImportFormat>('ofx')
  const [mode, setMode] = useState<ImportMode>('staged')
  const [destinationId, setDestinationId] = useState('')
  const [file, setFile] = useState<File | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [duplicateWarning, setDuplicateWarning] = useState<{ previousImportedAt: string } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    listAccounts().then(setAccounts).catch(() => {})
    listCards().then(setCards).catch(() => {})
  }, [])

  const isCardFormat = format === 'pdf_invoice'

  async function submit(confirmDuplicateFile: boolean) {
    if (!file || !destinationId) {
      setError('Escolha um arquivo e um destino.')
      return
    }
    setError(null)
    setIsSubmitting(true)
    try {
      const batch = await createImportBatch({
        file,
        format,
        mode,
        accountId: isCardFormat ? undefined : destinationId,
        cardId: isCardFormat ? destinationId : undefined,
        confirmDuplicateFile,
      })
      navigate(`/importacoes/${batch.id}`)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const data = err.data as { previousImportedAt?: string } | null
        if (data?.previousImportedAt) {
          setDuplicateWarning({ previousImportedAt: data.previousImportedAt })
          return
        }
      }
      setError(err instanceof ApiError ? err.message : 'Erro ao enviar o arquivo.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    await submit(false)
  }

  return (
    <div className="space-y-6">
      <PageHeader backTo="/importacoes" title="Nova Importação" />

      <UiCard className="max-w-xl">
        <form onSubmit={handleSubmit} aria-label="Nova importação" className="space-y-4">
          <Field label="Formato" htmlFor="import-format">
            <Select
              id="import-format"
              value={format}
              onChange={(e) => {
                setFormat(e.target.value as ImportFormat)
                setDestinationId('')
              }}
            >
              <option value="ofx">OFX (extrato)</option>
              <option value="csv">CSV (extrato)</option>
              <option value="pdf_invoice">PDF de fatura</option>
            </Select>
          </Field>

          <Field label={isCardFormat ? 'Cartão' : 'Conta'} htmlFor="import-destination">
            <Select
              id="import-destination"
              value={destinationId}
              onChange={(e) => setDestinationId(e.target.value)}
              required
            >
              <option value="">Selecione...</option>
              {(isCardFormat ? cards : accounts).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Modo" htmlFor="import-mode">
            <Select id="import-mode" value={mode} onChange={(e) => setMode(e.target.value as ImportMode)}>
              <option value="staged">Revisar tudo antes de confirmar</option>
              <option value="direct">Aceitar automaticamente (exceto suspeitas de duplicata)</option>
            </Select>
          </Field>

          <Field label="Arquivo" htmlFor="import-file">
            <input
              id="import-file"
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100 dark:text-slate-300 dark:file:bg-indigo-950 dark:file:text-indigo-300"
            />
          </Field>

          {error && <Alert>{error}</Alert>}

          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? 'Enviando...' : 'Enviar'}
          </Button>
        </form>
      </UiCard>

      {duplicateWarning && (
        <ConfirmPanel aria-label="Confirmar reimportação de arquivo duplicado" className="max-w-xl">
          <p>
            Um arquivo idêntico já foi importado com sucesso em {duplicateWarning.previousImportedAt.slice(0, 10)}.
            Deseja importar mesmo assim?
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="primary" onClick={() => submit(true)} disabled={isSubmitting}>
              Importar mesmo assim
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDuplicateWarning(null)}>
              Cancelar
            </Button>
          </div>
        </ConfirmPanel>
      )}
    </div>
  )
}
