import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listAccounts, deleteAccount, type Account } from '../accounts/accountsApi'
import { listCards, deleteCard, type Card } from '../cards/cardsApi'
import { AccountForm } from '../accounts/AccountForm'
import { CardForm } from '../cards/CardForm'

export function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    void loadAll()
  }, [])

  async function loadAll() {
    const [accountList, cardList] = await Promise.all([listAccounts(), listCards()])
    setAccounts(accountList)
    setCards(cardList)
    setLoaded(true)
  }

  async function handleDeleteAccount(id: string) {
    if (!window.confirm('Remover esta conta?')) return
    await deleteAccount(id)
    await loadAll()
  }

  async function handleDeleteCard(id: string) {
    if (!window.confirm('Remover este cartão?')) return
    await deleteCard(id)
    await loadAll()
  }

  return (
    <main>
      <p>
        <Link to="/">Voltar</Link>
      </p>
      <h1>Contas e Cartões</h1>

      <section>
        <h2>Contas</h2>
        {loaded && accounts.length === 0 && <p>Nenhuma conta cadastrada.</p>}
        <ul>
          {accounts.map((account) => (
            <li key={account.id}>
              {account.name} — {account.bank?.name} ({account.currency})
              <button type="button" onClick={() => handleDeleteAccount(account.id)}>
                Remover
              </button>
            </li>
          ))}
        </ul>
        <AccountForm onCreated={(account) => setAccounts((current) => [...current, account])} />
      </section>

      <section>
        <h2>Cartões</h2>
        {loaded && cards.length === 0 && <p>Nenhum cartão cadastrado.</p>}
        <ul>
          {cards.map((card) => (
            <li key={card.id}>
              {card.name} — limite {card.creditLimit}
              {card.linkedAccount ? ` — vinculado a ${card.linkedAccount.name}` : ' — sem vínculo'}
              <button type="button" onClick={() => handleDeleteCard(card.id)}>
                Remover
              </button>
            </li>
          ))}
        </ul>
        <CardForm accounts={accounts} onCreated={(card) => setCards((current) => [...current, card])} />
      </section>
    </main>
  )
}
