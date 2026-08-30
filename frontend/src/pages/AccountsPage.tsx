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
import {
  PageHeader,
  Card as UiCard,
  Input,
  Button,
  Badge,
  ConfirmPanel,
  ItemList,
  ItemRow,
  EmptyState,
} from '../components/ui'

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
    <div>
      <PageHeader backTo="/" title="Contas e Cartões" />

      <UiCard className="mb-6 flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor="balance-date" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Saldo/gasto em
          </label>
          <Input id="balance-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={includeHidden}
            onChange={(e) => setIncludeHidden(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 dark:border-slate-600"
          />
          Mostrar ocultas
        </label>
      </UiCard>

      {removalTarget && (
        <ConfirmPanel aria-label="Confirmar remoção" className="mb-6">
          <p>
            &ldquo;{removalTarget.name}&rdquo; tem lançamentos associados. Excluir em cascata é
            definitivo e irreversível — remove também todo o histórico. Escolha uma opção:
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => resolveRemoval('deactivate')}>
              Desativar
            </Button>
            <Button size="sm" onClick={() => resolveRemoval('hide')}>
              Ocultar
            </Button>
            <Button size="sm" variant="danger" onClick={() => resolveRemoval('cascade')}>
              Excluir em cascata (irreversível)
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setRemovalTarget(null)}>
              Cancelar
            </Button>
          </div>
        </ConfirmPanel>
      )}

      <section className="mb-8">
        <h2 className="mb-3">Contas</h2>
        {loaded && accounts.length === 0 ? (
          <EmptyState>Nenhuma conta cadastrada.</EmptyState>
        ) : (
          <ItemList className="mb-4">
            {accounts.map((account) => (
              <ItemRow key={account.id}>
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-50">
                    {account.name}
                    {!account.isActive && (
                      <Badge tone="slate" className="ml-2">
                        inativa
                      </Badge>
                    )}
                    {account.isHidden && (
                      <Badge tone="slate" className="ml-2">
                        oculta
                      </Badge>
                    )}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {account.bank?.name} ({account.currency}) — saldo {account.currentBalance} — previsto{' '}
                    {account.projectedBalance}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => toggleAccountFlag(account, 'isActive')}>
                    {account.isActive ? 'Desativar' : 'Ativar'}
                  </Button>
                  <Button size="sm" onClick={() => toggleAccountFlag(account, 'isHidden')}>
                    {account.isHidden ? 'Reexibir' : 'Ocultar'}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => attemptDelete({ kind: 'account', id: account.id, name: account.name })}
                  >
                    Remover
                  </Button>
                </div>
              </ItemRow>
            ))}
          </ItemList>
        )}
        <UiCard>
          <AccountForm onCreated={() => loadAll()} />
        </UiCard>
      </section>

      <section>
        <h2 className="mb-3">Cartões</h2>
        {loaded && cards.length === 0 ? (
          <EmptyState>Nenhum cartão cadastrado.</EmptyState>
        ) : (
          <ItemList className="mb-4">
            {cards.map((card) => (
              <ItemRow key={card.id}>
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-50">
                    {card.name}
                    {!card.isActive && (
                      <Badge tone="slate" className="ml-2">
                        inativo
                      </Badge>
                    )}
                    {card.isHidden && (
                      <Badge tone="slate" className="ml-2">
                        oculto
                      </Badge>
                    )}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    limite {card.creditLimit} — gasto {card.currentSpending} — disponível{' '}
                    {card.availableLimit}
                    {card.linkedAccount ? ` — vinculado a ${card.linkedAccount.name}` : ' — sem vínculo'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    to={`/cartoes/${card.id}/faturas`}
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                  >
                    Ver faturas
                  </Link>
                  <Button size="sm" onClick={() => toggleCardFlag(card, 'isActive')}>
                    {card.isActive ? 'Desativar' : 'Ativar'}
                  </Button>
                  <Button size="sm" onClick={() => toggleCardFlag(card, 'isHidden')}>
                    {card.isHidden ? 'Reexibir' : 'Ocultar'}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => attemptDelete({ kind: 'card', id: card.id, name: card.name })}
                  >
                    Remover
                  </Button>
                </div>
              </ItemRow>
            ))}
          </ItemList>
        )}
        <UiCard>
          <CardForm accounts={accounts} onCreated={() => loadAll()} />
        </UiCard>
      </section>
    </div>
  )
}
