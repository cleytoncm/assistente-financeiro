import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { CardInvoicesPage } from './CardInvoicesPage'
import { createCard } from '../cards/cardsApi'
import { createTransaction } from '../transactions/transactionsApi'
import { money } from '../test/money'

function renderPage(cardId: string) {
  return render(
    <MemoryRouter initialEntries={[`/cartoes/${cardId}/faturas`]}>
      <Routes>
        <Route path="/cartoes/:cardId/faturas" element={<CardInvoicesPage />} />
        <Route path="/faturas/:invoiceId" element={<p>Detalhe da fatura</p>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('CardInvoicesPage', () => {
  it('lists the invoices generated for a card', async () => {
    const card = await createCard({ name: 'Cartão Faturas', creditLimit: 1000, closingDay: 10, dueDay: 20 })
    await createTransaction({
      type: 'expense',
      amount: 100,
      date: '2024-03-10',
      description: 'Compra',
      cardId: card.id,
    })

    renderPage(card.id)

    expect(await screen.findByText(/Cartão Faturas/)).toBeInTheDocument()
    expect(await screen.findByText('03/2024')).toBeInTheDocument()
    expect(screen.getByText(`total ${money(100)}`)).toBeInTheDocument()
  })

  it('navigates to the invoice detail page', async () => {
    const user = userEvent.setup()
    const card = await createCard({ name: 'Cartão Navegação', creditLimit: 1000, closingDay: 10, dueDay: 20 })
    await createTransaction({
      type: 'expense',
      amount: 50,
      date: '2024-05-05',
      description: 'Compra',
      cardId: card.id,
    })

    renderPage(card.id)

    await user.click(await screen.findByRole('link', { name: '05/2024' }))
    expect(await screen.findByText('Detalhe da fatura')).toBeInTheDocument()
  })

  it('shows an empty state when the card has no invoices yet', async () => {
    const card = await createCard({ name: 'Cartão Sem Fatura', creditLimit: 1000, closingDay: 10, dueDay: 20 })
    renderPage(card.id)
    expect(await screen.findByText('Nenhuma fatura encontrada.')).toBeInTheDocument()
  })
})
