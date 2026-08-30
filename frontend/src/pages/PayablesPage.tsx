import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listAccounts, type Account } from '../accounts/accountsApi'
import { listPayables, getPayablesSummary, type Payable, type PayableStatus } from '../payables/payablesApi'
import { listPayableGroups, type PayableGroup } from '../payables/payableGroupsApi'
import { PayableForm } from '../payables/PayableForm'
import { PayableRow } from '../payables/PayableRow'

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
    <main>
      <p>
        <Link to="/">Voltar</Link>
      </p>
      <h1>Contas a Pagar/Receber</h1>

      <section>
        <label htmlFor="payables-until">Total previsto até</label>
        <input id="payables-until" type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
        {summary && (
          <p>
            A pagar: {summary.totalPayable} — A receber: {summary.totalReceivable}
          </p>
        )}
      </section>

      <section>
        <h2>Filtros</h2>
        <label htmlFor="payables-filter-type">Tipo</label>
        <select
          id="payables-filter-type"
          value={type}
          onChange={(e) => setType(e.target.value as '' | 'income' | 'expense')}
        >
          <option value="">Todos</option>
          <option value="expense">A pagar</option>
          <option value="income">A receber</option>
        </select>

        <label htmlFor="payables-filter-status">Status</label>
        <select
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
        </select>
      </section>

      <PayableForm onCreated={() => loadAll()} />

      <section>
        <h2>Grupos (parceladas/recorrentes)</h2>
        {loaded && groups.length === 0 && <p>Nenhum grupo cadastrado.</p>}
        <ul>
          {groups.map((group) => (
            <li key={group.id}>
              <Link to={`/contas-a-pagar/grupos/${group.id}`}>
                {group.description ?? (group.type === 'expense' ? 'A pagar' : 'A receber')}
              </Link>{' '}
              — {group.recurrenceType === 'installment' ? 'parcelada' : 'recorrente'} — {group.payableCount} parcela(s)
              {group.nextDueDate && ` — próxima em ${group.nextDueDate}`}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Avulsas</h2>
        {loaded && standalone.length === 0 && <p>Nenhuma conta avulsa cadastrada.</p>}
        <ul>
          {standalone.map((payable) => (
            <PayableRow key={payable.id} payable={payable} accounts={accounts} onChanged={loadAll} />
          ))}
        </ul>
      </section>
    </main>
  )
}
