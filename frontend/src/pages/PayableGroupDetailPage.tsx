import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { listAccounts, type Account } from '../accounts/accountsApi'
import {
  getPayableGroup,
  updatePayableGroup,
  deletePayableGroup,
  type PayableGroupDetail,
} from '../payables/payableGroupsApi'
import { PayableRow } from '../payables/PayableRow'
import { ApiError } from '../lib/httpClient'
import {
  PageHeader,
  Card as UiCard,
  Field,
  Input,
  Select,
  Button,
  Alert,
  ConfirmPanel,
  ItemList,
} from '../components/ui'

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
      <div>
        <p className="text-sm text-slate-500 dark:text-slate-400">Carregando...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        backTo="/contas-a-pagar"
        title={group.description ?? (group.type === 'expense' ? 'A pagar' : 'A receber')}
      />
      {group.counterparty && (
        <p className="-mt-4 text-sm text-slate-500 dark:text-slate-400">Contraparte: {group.counterparty}</p>
      )}

      <UiCard>
        <h2 className="mb-1">Editar grupo</h2>
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
          Atenção: alterar esses dados afeta todas as parcelas ainda não pagas nem canceladas.
        </p>
        <form onSubmit={handleEditSubmit} aria-label="Editar grupo" className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field label="Valor por parcela" htmlFor="group-amount">
              <Input
                id="group-amount"
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>
            <Field label="Dia de vencimento" htmlFor="group-due-day">
              <Input
                id="group-due-day"
                type="number"
                min={1}
                max={31}
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
              />
            </Field>
            <Field label="Descrição" htmlFor="group-description">
              <Input id="group-description" value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
            <Field label="Contraparte" htmlFor="group-counterparty">
              <Input
                id="group-counterparty"
                value={counterparty}
                onChange={(e) => setCounterparty(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Conta sugerida" htmlFor="group-account">
            <Select id="group-account" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">Nenhuma</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit" variant="primary">
            Salvar alterações
          </Button>
          {editError && <Alert>{editError}</Alert>}
        </form>
      </UiCard>

      <UiCard>
        <h2 className="mb-3">Encerrar grupo</h2>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Escopo" htmlFor="close-scope">
            <Select
              id="close-scope"
              value={closeScope}
              onChange={(e) => setCloseScope(e.target.value as 'pending' | 'all')}
            >
              <option value="pending">Só as pendentes</option>
              <option value="all">Tudo (inclusive pagas)</option>
            </Select>
          </Field>
          <Button type="button" variant="danger" onClick={() => handleClose(false)}>
            Encerrar grupo
          </Button>
        </div>
        {closeError && <Alert className="mt-3">{closeError}</Alert>}
        {closeConfirmation && (
          <ConfirmPanel aria-label="Confirmar exclusão de parcelas pagas" className="mt-3">
            <p>
              Este grupo tem {closeConfirmation.deletePaidCount} parcela(s) paga(s). Excluir tudo também removerá as
              transações vinculadas a elas. Deseja continuar?
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="primary" onClick={() => handleClose(true)}>
                Confirmar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setCloseConfirmation(null)}>
                Voltar
              </Button>
            </div>
          </ConfirmPanel>
        )}
      </UiCard>

      <section>
        <h2 className="mb-3">Parcelas</h2>
        <ItemList>
          {group.payables.map((payable) => (
            <PayableRow key={payable.id} payable={payable} accounts={accounts} onChanged={() => load(group.id)} />
          ))}
        </ItemList>
      </section>
    </div>
  )
}
