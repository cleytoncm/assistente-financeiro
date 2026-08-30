import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  listAccounts,
  deleteAccount,
  updateAccountStatus,
  type Account,
} from '../accounts/accountsApi'
import { listCards, deleteCard, updateCardStatus, type Card } from '../cards/cardsApi'
import { AccountForm } from '../accounts/AccountForm'
import { CardForm } from '../cards/CardForm'
import { ApiError } from '../lib/httpClient'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

type RemovalTarget = { kind: 'account' | 'card'; id: string; name: string }

export function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [loaded, setLoaded] = useState(false)
  const [date, setDate] = useState(today())
  const [includeHidden, setIncludeHidden] = useState(false)
  const [removalTarget, setRemovalTarget] = useState<RemovalTarget | null>(null)

  useEffect(() => {
    void loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, includeHidden])

  async function loadAll() {
    const [accountList, cardList] = await Promise.all([
      listAccounts({ date, includeHidden }),
      listCards({ date, includeHidden }),
    ])
    setAccounts(accountList)
    setCards(cardList)
    setLoaded(true)
  }

  async function attemptDelete(target: RemovalTarget) {
    try {
      if (target.kind === 'account') await deleteAccount(target.id)
      else await deleteCard(target.id)
      await loadAll()
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setRemovalTarget(target)
        return
      }
      throw err
    }
  }

  async function resolveRemoval(action: 'deactivate' | 'hide' | 'cascade') {
    if (!removalTarget) return
    const { kind, id } = removalTarget

    if (action === 'deactivate') {
      if (kind === 'account') await updateAccountStatus(id, { isActive: false })
      else await updateCardStatus(id, { isActive: false })
    } else if (action === 'hide') {
      if (kind === 'account') await updateAccountStatus(id, { isHidden: true })
      else await updateCardStatus(id, { isHidden: true })
    } else {
      if (kind === 'account') await deleteAccount(id, true)
      else await deleteCard(id, true)
    }

    setRemovalTarget(null)
    await loadAll()
  }

  async function toggleAccountFlag(account: Account, flag: 'isActive' | 'isHidden') {
    await updateAccountStatus(account.id, { [flag]: !account[flag] })
    await loadAll()
  }

  async function toggleCardFlag(card: Card, flag: 'isActive' | 'isHidden') {
    await updateCardStatus(card.id, { [flag]: !card[flag] })
    await loadAll()
  }

  return (
    <main>
      <p>
        <Link to="/">Voltar</Link>
      </p>
      <h1>Contas e Cartões</h1>

      <section>
        <label htmlFor="balance-date">Saldo/gasto em</label>
        <input id="balance-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <label>
          <input
            type="checkbox"
            checked={includeHidden}
            onChange={(e) => setIncludeHidden(e.target.checked)}
          />
          Mostrar ocultas
        </label>
      </section>

      {removalTarget && (
        <section role="alertdialog" aria-label="Confirmar remoção">
          <p>
            "{removalTarget.name}" tem lançamentos associados. Excluir em cascata é definitivo e
            irreversível — remove também todo o histórico. Escolha uma opção:
          </p>
          <button type="button" onClick={() => resolveRemoval('deactivate')}>
            Desativar
          </button>
          <button type="button" onClick={() => resolveRemoval('hide')}>
            Ocultar
          </button>
          <button type="button" onClick={() => resolveRemoval('cascade')}>
            Excluir em cascata (irreversível)
          </button>
          <button type="button" onClick={() => setRemovalTarget(null)}>
            Cancelar
          </button>
        </section>
      )}

      <section>
        <h2>Contas</h2>
        {loaded && accounts.length === 0 && <p>Nenhuma conta cadastrada.</p>}
        <ul>
          {accounts.map((account) => (
            <li key={account.id}>
              {account.name} — {account.bank?.name} ({account.currency}) — saldo {account.currentBalance}
              {' '}— previsto {account.projectedBalance}
              {!account.isActive && ' — inativa'}
              {account.isHidden && ' — oculta'}
              <button type="button" onClick={() => toggleAccountFlag(account, 'isActive')}>
                {account.isActive ? 'Desativar' : 'Ativar'}
              </button>
              <button type="button" onClick={() => toggleAccountFlag(account, 'isHidden')}>
                {account.isHidden ? 'Reexibir' : 'Ocultar'}
              </button>
              <button
                type="button"
                onClick={() => attemptDelete({ kind: 'account', id: account.id, name: account.name })}
              >
                Remover
              </button>
            </li>
          ))}
        </ul>
        <AccountForm onCreated={() => loadAll()} />
      </section>

      <section>
        <h2>Cartões</h2>
        {loaded && cards.length === 0 && <p>Nenhum cartão cadastrado.</p>}
        <ul>
          {cards.map((card) => (
            <li key={card.id}>
              {card.name} — limite {card.creditLimit} — gasto {card.currentSpending} — disponível{' '}
              {card.availableLimit}
              {card.linkedAccount ? ` — vinculado a ${card.linkedAccount.name}` : ' — sem vínculo'}
              {!card.isActive && ' — inativo'}
              {card.isHidden && ' — oculto'}
              <button type="button" onClick={() => toggleCardFlag(card, 'isActive')}>
                {card.isActive ? 'Desativar' : 'Ativar'}
              </button>
              <button type="button" onClick={() => toggleCardFlag(card, 'isHidden')}>
                {card.isHidden ? 'Reexibir' : 'Ocultar'}
              </button>
              <button type="button" onClick={() => attemptDelete({ kind: 'card', id: card.id, name: card.name })}>
                Remover
              </button>
              <Link to={`/cartoes/${card.id}/faturas`}>Ver faturas</Link>
            </li>
          ))}
        </ul>
        <CardForm accounts={accounts} onCreated={() => loadAll()} />
      </section>
    </main>
  )
}
