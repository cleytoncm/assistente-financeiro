import { useEffect, useState, type FormEvent } from 'react'
import { listBanks, createBank, type Bank } from '../banks/banksApi'
import { createAccount, type Account } from './accountsApi'
import { ApiError } from '../lib/httpClient'
import { Field, Input, Select, Button, Alert } from '../components/ui'

export function AccountForm({ onCreated }: { onCreated: (account: Account) => void }) {
  const [banks, setBanks] = useState<Bank[]>([])
  const [name, setName] = useState('')
  const [bankId, setBankId] = useState('')
  const [currency, setCurrency] = useState('BRL')
  const [initialBalance, setInitialBalance] = useState('0')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [showNewBank, setShowNewBank] = useState(false)
  const [newBankName, setNewBankName] = useState('')
  const [newBankCode, setNewBankCode] = useState('')

  async function loadBanks() {
    const list = await listBanks()
    setBanks(list)
    if (list.length > 0 && !bankId) {
      setBankId(list[0]!.id)
    }
  }

  // Runs once on mount to populate the bank select; loadBanks is re-invoked directly (not via
  // this effect) after creating a new bank inline, so it's intentionally not a dependency here
  // (the exhaustive-deps warning this triggers is expected and safe to ignore).
  useEffect(() => {
    loadBanks()
  }, [])

  async function handleCreateBank(event: FormEvent) {
    event.preventDefault()
    try {
      const bank = await createBank({ name: newBankName, code: newBankCode })
      setBanks((current) => [...current, bank].sort((a, b) => a.name.localeCompare(b.name)))
      setBankId(bank.id)
      setShowNewBank(false)
      setNewBankName('')
      setNewBankCode('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao cadastrar banco.')
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const account = await createAccount({
        name,
        bankId,
        currency,
        initialBalance: Number(initialBalance),
      })
      onCreated(account)
      setName('')
      setInitialBalance('0')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao criar conta.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-label="Nova conta" className="space-y-4">
      <Field label="Nome da conta" htmlFor="account-name">
        <Input id="account-name" value={name} onChange={(e) => setName(e.target.value)} required />
      </Field>

      <Field label="Banco" htmlFor="account-bank">
        <div className="flex items-center gap-2">
          <Select id="account-bank" value={bankId} onChange={(e) => setBankId(e.target.value)} required>
            {banks.map((bank) => (
              <option key={bank.id} value={bank.id}>
                {bank.name}
              </option>
            ))}
          </Select>
          <Button type="button" size="sm" className="shrink-0" onClick={() => setShowNewBank((v) => !v)}>
            {showNewBank ? 'Cancelar' : 'Cadastrar novo banco'}
          </Button>
        </div>
      </Field>

      {showNewBank && (
        <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
          <Field label="Nome do banco" htmlFor="new-bank-name">
            <Input id="new-bank-name" value={newBankName} onChange={(e) => setNewBankName(e.target.value)} />
          </Field>
          <Field label="Código" htmlFor="new-bank-code">
            <Input id="new-bank-code" value={newBankCode} onChange={(e) => setNewBankCode(e.target.value)} />
          </Field>
          <Button type="button" size="sm" onClick={handleCreateBank}>
            Salvar banco
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Field label="Moeda" htmlFor="account-currency">
          <Input
            id="account-currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            maxLength={3}
          />
        </Field>

        <Field label="Saldo inicial" htmlFor="account-initial-balance">
          <Input
            id="account-initial-balance"
            type="number"
            step="0.01"
            value={initialBalance}
            onChange={(e) => setInitialBalance(e.target.value)}
            required
          />
        </Field>
      </div>

      {error && <Alert>{error}</Alert>}

      <Button type="submit" variant="primary" disabled={isSubmitting}>
        {isSubmitting ? 'Criando...' : 'Criar conta'}
      </Button>
    </form>
  )
}
