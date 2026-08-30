import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listAccounts, type Account } from '../accounts/accountsApi'
import { listPayables, getPayablesSummary, type Payable, type PayableStatus } from '../payables/payablesApi'
import { listPayableGroups, type PayableGroup } from '../payables/payableGroupsApi'
import { PayableForm } from '../payables/PayableForm'
import { PayableRow } from '../payables/PayableRow'
import {
  PageHeader,
  Card as UiCard,
  Field,
  Input,
  Select,
  Badge,
  ItemList,
  ItemRow,
  EmptyState,
} from '../components/ui'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

const STATUS_OPTIONS: PayableStatus[] = ['pendente', 'vence_hoje', 'atrasada', 'paga', 'cancelada']

export function PayablesPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [standalone, setStandalone] = useState<Payable[]>([])
  const [groups, setGroups] = useState<PayableGroup[]>([])
  const [summary, setSummary] = useState<{ totalPayable: string; totalReceivable: string } | null>(null)
  const [loaded, setLoaded] = useState(false)

  const [type, setType] = useState<'' | 'income' | 'expense'>('')
  const [status, setStatus] = useState<'' | PayableStatus>('')
  const [until, setUntil] = useState(today())

  useEffect(() => {
    listAccounts().then(setAccounts).catch(() => {})
  }, [])

  useEffect(() => {
    void loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, status, until])

  async function loadAll() {
    const [payablesResult, groupList, summaryResult] = await Promise.all([
      listPayables({ type: type || undefined, status: status || undefined }),
      listPayableGroups({ type: type || undefined }),
      getPayablesSummary(until),
    ])
    setStandalone(payablesResult.items.filter((p) => p.groupId === null))
    setGroups(groupList)
    setSummary(summaryResult)
    setLoaded(true)
  }

  return (
    <div className="space-y-6">
      <PageHeader backTo="/" title="Contas a Pagar/Receber" />

      <UiCard className="flex flex-wrap items-end gap-4">
        <Field label="Total previsto até" htmlFor="payables-until">
          <Input id="payables-until" type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
        </Field>
        {summary && (
          <div className="flex gap-4 pb-2 text-sm">
            <span className="text-red-600 dark:text-red-400">A pagar: {summary.totalPayable}</span>
            <span className="text-emerald-600 dark:text-emerald-400">A receber: {summary.totalReceivable}</span>
          </div>
        )}
      </UiCard>

      <UiCard>
        <h2 className="mb-3">Filtros</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Tipo" htmlFor="payables-filter-type">
            <Select
              id="payables-filter-type"
              value={type}
              onChange={(e) => setType(e.target.value as '' | 'income' | 'expense')}
            >
              <option value="">Todos</option>
              <option value="expense">A pagar</option>
              <option value="income">A receber</option>
            </Select>
          </Field>

          <Field label="Status" htmlFor="payables-filter-status">
            <Select
              id="payables-filter-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as '' | PayableStatus)}
            >
              <option value="">Todos</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </UiCard>

      <UiCard>
        <PayableForm onCreated={() => loadAll()} />
      </UiCard>

      <section>
        <h2 className="mb-3">Grupos (parceladas/recorrentes)</h2>
        {loaded && groups.length === 0 ? (
          <EmptyState>Nenhum grupo cadastrado.</EmptyState>
        ) : (
          <ItemList>
            {groups.map((group) => (
              <ItemRow key={group.id}>
                <Link
                  to={`/contas-a-pagar/grupos/${group.id}`}
                  className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                >
                  {group.description ?? (group.type === 'expense' ? 'A pagar' : 'A receber')}
                </Link>
                <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                  <Badge tone="slate">{group.recurrenceType === 'installment' ? 'parcelada' : 'recorrente'}</Badge>
                  <span>{group.payableCount} parcela(s)</span>
                  {group.nextDueDate && <span>próxima em {group.nextDueDate}</span>}
                </div>
              </ItemRow>
            ))}
          </ItemList>
        )}
      </section>

      <section>
        <h2 className="mb-3">Avulsas</h2>
        {loaded && standalone.length === 0 ? (
          <EmptyState>Nenhuma conta avulsa cadastrada.</EmptyState>
        ) : (
          <ItemList>
            {standalone.map((payable) => (
              <PayableRow key={payable.id} payable={payable} accounts={accounts} onChanged={loadAll} />
            ))}
          </ItemList>
        )}
      </section>
    </div>
  )
}
