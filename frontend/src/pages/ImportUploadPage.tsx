import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listAccounts, type Account } from '../accounts/accountsApi'
import { listCards, type Card } from '../cards/cardsApi'
import { createImportBatch, type ImportFormat, type ImportMode } from '../imports/importsApi'
import { ApiError } from '../lib/httpClient'

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
    <main>
      <p>
        <Link to="/importacoes">Voltar</Link>
      </p>
      <h1>Nova Importação</h1>

      <form onSubmit={handleSubmit} aria-label="Nova importação">
        <label htmlFor="import-format">Formato</label>
        <select
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
        </select>

        <label htmlFor="import-destination">{isCardFormat ? 'Cartão' : 'Conta'}</label>
        <select
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
        </select>

        <label htmlFor="import-mode">Modo</label>
        <select id="import-mode" value={mode} onChange={(e) => setMode(e.target.value as ImportMode)}>
          <option value="staged">Revisar tudo antes de confirmar</option>
          <option value="direct">Aceitar automaticamente (exceto suspeitas de duplicata)</option>
        </select>

        <label htmlFor="import-file">Arquivo</label>
        <input
          id="import-file"
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />

        {error && <p role="alert">{error}</p>}

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Enviando...' : 'Enviar'}
        </button>
      </form>

      {duplicateWarning && (
        <section role="alertdialog" aria-label="Confirmar reimportação de arquivo duplicado">
          <p>
            Um arquivo idêntico já foi importado com sucesso em {duplicateWarning.previousImportedAt.slice(0, 10)}.
            Deseja importar mesmo assim?
          </p>
          <button type="button" onClick={() => submit(true)} disabled={isSubmitting}>
            Importar mesmo assim
          </button>
          <button type="button" onClick={() => setDuplicateWarning(null)}>
            Cancelar
          </button>
        </section>
      )}
    </main>
  )
}
