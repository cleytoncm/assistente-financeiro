import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { listAccounts, type Account } from '../accounts/accountsApi'
import {
  getPayableGroup,
  updatePayableGroup,
  deletePayableGroup,
  type PayableGroupDetail,
} from '../payables/payableGroupsApi'
import { PayableRow } from '../payables/PayableRow'
import { ApiError } from '../lib/httpClient'

export function PayableGroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>()
  const navigate = useNavigate()
  const [group, setGroup] = useState<PayableGroupDetail | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])

  const [amount, setAmount] = useState('')
  const [dueDay, setDueDay] = useState('')
  const [description, setDescription] = useState('')
  const [counterparty, setCounterparty] = useState('')
  const [accountId, setAccountId] = useState('')
  const [editError, setEditError] = useState<string | null>(null)

  const [closeScope, setCloseScope] = useState<'pending' | 'all'>('pending')
  const [closeConfirmation, setCloseConfirmation] = useState<{ deletePaidCount: number } | null>(null)
  const [closeError, setCloseError] = useState<string | null>(null)

  async function load(id: string) {
    const [detail, accountList] = await Promise.all([getPayableGroup(id), listAccounts()])
    setGroup(detail)
    setAccounts(accountList)
    setAmount(detail.amount)
    setDueDay(String(detail.dueDay))
    setDescription(detail.description ?? '')
    setCounterparty(detail.counterparty ?? '')
    setAccountId(detail.accountId ?? '')
  }

  useEffect(() => {
    if (!groupId) return
    void load(groupId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId])

  async function handleEditSubmit(event: FormEvent) {
    event.preventDefault()
    if (!group) return
    setEditError(null)
    try {
      await updatePayableGroup(group.id, {
        amount: Number(amount),
        dueDay: Number(dueDay),
        description: description || null,
        counterparty: counterparty || null,
        accountId: accountId || null,
      })
      await load(group.id)
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : 'Erro ao editar grupo.')
    }
  }

  async function handleClose(confirmDeleteTransactions = false) {
    if (!group) return
    setCloseError(null)
    try {
      await deletePayableGroup(group.id, closeScope, confirmDeleteTransactions)
      navigate('/contas-a-pagar')
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const data = err.data as { deletePaidCount?: number } | null
        if (data?.deletePaidCount !== undefined) {
          setCloseConfirmation({ deletePaidCount: data.deletePaidCount })
          return
        }
      }
      setCloseError(err instanceof ApiError ? err.message : 'Erro ao encerrar grupo.')
    }
  }

  if (!group) {
    return (
      <main>
        <p>Carregando...</p>
      </main>
    )
  }

  return (
    <main>
      <p>
        <Link to="/contas-a-pagar">Voltar</Link>
      </p>
      <h1>{group.description ?? (group.type === 'expense' ? 'A pagar' : 'A receber')}</h1>
      <p>{group.counterparty && `Contraparte: ${group.counterparty}`}</p>

      <section>
        <h2>Editar grupo</h2>
        <p>Atenção: alterar esses dados afeta todas as parcelas ainda não pagas nem canceladas.</p>
        <form onSubmit={handleEditSubmit} aria-label="Editar grupo">
          <label htmlFor="group-amount">Valor por parcela</label>
          <input
            id="group-amount"
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <label htmlFor="group-due-day">Dia de vencimento</label>
          <input
            id="group-due-day"
            type="number"
            min={1}
            max={31}
            value={dueDay}
            onChange={(e) => setDueDay(e.target.value)}
          />
          <label htmlFor="group-description">Descrição</label>
          <input id="group-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <label htmlFor="group-counterparty">Contraparte</label>
          <input id="group-counterparty" value={counterparty} onChange={(e) => setCounterparty(e.target.value)} />
          <label htmlFor="group-account">Conta sugerida</label>
          <select id="group-account" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">Nenhuma</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
          <button type="submit">Salvar alterações</button>
          {editError && <p role="alert">{editError}</p>}
        </form>
      </section>

      <section>
        <h2>Encerrar grupo</h2>
        <label htmlFor="close-scope">Escopo</label>
        <select id="close-scope" value={closeScope} onChange={(e) => setCloseScope(e.target.value as 'pending' | 'all')}>
          <option value="pending">Só as pendentes</option>
          <option value="all">Tudo (inclusive pagas)</option>
        </select>
        <button type="button" onClick={() => handleClose(false)}>
          Encerrar grupo
        </button>
        {closeError && <p role="alert">{closeError}</p>}
        {closeConfirmation && (
          <section role="alertdialog" aria-label="Confirmar exclusão de parcelas pagas">
            <p>
              Este grupo tem {closeConfirmation.deletePaidCount} parcela(s) paga(s). Excluir tudo também removerá as
              transações vinculadas a elas. Deseja continuar?
            </p>
            <button type="button" onClick={() => handleClose(true)}>
              Confirmar
            </button>
            <button type="button" onClick={() => setCloseConfirmation(null)}>
              Voltar
            </button>
          </section>
        )}
      </section>

      <section>
        <h2>Parcelas</h2>
        <ul>
          {group.payables.map((payable) => (
            <PayableRow
              key={payable.id}
              payable={payable}
              accounts={accounts}
              onChanged={() => load(group.id)}
            />
          ))}
        </ul>
      </section>
    </main>
  )
}
