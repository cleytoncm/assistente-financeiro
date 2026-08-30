import { describe, expect, it } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { InvoiceDetailPage } from './InvoiceDetailPage'
import { createCard } from '../cards/cardsApi'
import { createAccount } from '../accounts/accountsApi'
import { createTransaction } from '../transactions/transactionsApi'
import { listInvoicesForCard } from '../invoices/invoicesApi'
import { listBanks } from '../banks/banksApi'
import { money } from '../test/money'
import { formatCurrency } from '../lib/currency'

function renderPage(invoiceId: string) {
  return render(
    <MemoryRouter initialEntries={[`/faturas/${invoiceId}`]}>
      <Routes>
        <Route path="/faturas/:invoiceId" element={<InvoiceDetailPage />} />
        <Route path="/cartoes/:cardId/faturas" element={<p>Lista de faturas</p>} />
      </Routes>
    </MemoryRouter>
  )
}

async function seedAccount(name: string) {
  const [bank] = await listBanks()
  return createAccount({ name, bankId: bank!.id, initialBalance: 0 })
}

describe('InvoiceDetailPage', () => {
  it('shows the invoice total and its transactions', async () => {
    const card = await createCard({ name: 'Cartão Detalhe', creditLimit: 1000, closingDay: 10, dueDay: 20 })
    await createTransaction({
      type: 'expense',
      amount: 75,
      date: '2024-06-05',
      description: 'Farmácia',
      cardId: card.id,
    })
    const [invoice] = await listInvoicesForCard(card.id)

    renderPage(invoice!.id)

    expect(await screen.findByRole('heading', { name: 'Fatura 06/2024' })).toBeInTheDocument()
    expect(screen.getByText(`Total: ${money(75)}`)).toBeInTheDocument()
    expect(await screen.findByText(/Farmácia/)).toBeInTheDocument()
  })

  it('edits the closing and due dates', async () => {
    const user = userEvent.setup()
    const card = await createCard({ name: 'Cartão Datas', creditLimit: 1000, closingDay: 10, dueDay: 20 })
    await createTransaction({
      type: 'expense',
      amount: 30,
      date: '2024-07-05',
      description: 'Compra',
      cardId: card.id,
    })
    const [invoice] = await listInvoicesForCard(card.id)

    renderPage(invoice!.id)
    await screen.findByRole('heading', { name: 'Fatura 07/2024' })

    const closingInput = screen.getByLabelText('Fechamento') as HTMLInputElement
    fireEvent.change(closingInput, { target: { value: '2024-07-15' } })
    await user.click(screen.getByRole('button', { name: 'Salvar datas' }))

    expect(await screen.findByDisplayValue('2024-07-15')).toBeInTheDocument()
  })

  it('pre-selects the linked account and pays the invoice', async () => {
    const user = userEvent.setup()
    const account = await seedAccount('Conta Vinculada')
    const card = await createCard({
      name: 'Cartão Vinculado',
      creditLimit: 1000,
      closingDay: 10,
      dueDay: 20,
      linkedAccountId: account.id,
    })
    await createTransaction({
      type: 'expense',
      amount: 40,
      date: '2024-08-05',
      description: 'Compra',
      cardId: card.id,
    })
    const [invoice] = await listInvoicesForCard(card.id)

    renderPage(invoice!.id)
    await screen.findByRole('heading', { name: 'Fatura 08/2024' })

    expect(screen.getByLabelText('Conta pagadora')).toHaveValue(account.id)

    await user.click(screen.getByRole('button', { name: `Pagar fatura (${formatCurrency(40)})` }))

    expect(await screen.findByText('Fatura paga.')).toBeInTheDocument()
    expect(screen.getByText('Paga')).toBeInTheDocument()
  })
})
