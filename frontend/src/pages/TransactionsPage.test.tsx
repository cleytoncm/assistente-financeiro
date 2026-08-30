import { describe, expect, it } from 'vitest'
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { TransactionsPage } from './TransactionsPage'
import { createAccount } from '../accounts/accountsApi'
import { createCard } from '../cards/cardsApi'
import { listBanks } from '../banks/banksApi'
import { createTransaction } from '../transactions/transactionsApi'
import { listInvoicesForCard, payInvoice } from '../invoices/invoicesApi'

function renderPage() {
  return render(
    <MemoryRouter>
      <TransactionsPage />
    </MemoryRouter>
  )
}

async function seedAccount(name: string) {
  const [bank] = await listBanks()
  return createAccount({ name, bankId: bank!.id, initialBalance: 0 })
}

describe('TransactionsPage', () => {
  it('creates a transaction and lists it in the extrato', async () => {
    const user = userEvent.setup()
    await seedAccount('Conta Extrato')
    renderPage()

    await within(screen.getByLabelText('Conta ou cartão')).findByRole('option', { name: 'Conta Extrato' })
    await user.type(screen.getByLabelText('Valor'), '50')
    await user.type(screen.getByLabelText('Descrição'), 'Mercado')
    await user.selectOptions(screen.getByLabelText('Conta ou cartão'), 'Conta Extrato')
    await user.click(screen.getByRole('button', { name: 'Lançar' }))

    expect(await screen.findByText(/Mercado/)).toBeInTheDocument()
  })

  it('shows the installments field only when a card is selected', async () => {
    const user = userEvent.setup()
    await createCard({ name: 'Cartão Extrato', creditLimit: 1000, closingDay: 10, dueDay: 20 })
    renderPage()

    await within(screen.getByLabelText('Conta ou cartão')).findByRole('option', { name: 'Cartão Extrato' })
    expect(screen.queryByLabelText('Parcelar em (opcional)')).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Conta ou cartão'), 'Cartão Extrato')
    expect(screen.getByLabelText('Parcelar em (opcional)')).toBeInTheDocument()
  })

  it('edits a transaction description', async () => {
    const user = userEvent.setup()
    await seedAccount('Conta Editar')
    renderPage()

    await within(screen.getByLabelText('Conta ou cartão')).findByRole('option', { name: 'Conta Editar' })
    await user.type(screen.getByLabelText('Valor'), '20')
    await user.type(screen.getByLabelText('Descrição'), 'Original')
    await user.selectOptions(screen.getByLabelText('Conta ou cartão'), 'Conta Editar')
    await user.click(screen.getByRole('button', { name: 'Lançar' }))
    await screen.findByText(/Original/)

    await user.click(screen.getByRole('button', { name: 'Editar' }))
    const descriptionInput = screen.getByLabelText('Descrição de Original')
    await user.clear(descriptionInput)
    await user.type(descriptionInput, 'Atualizado')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText(/Atualizado/)).toBeInTheDocument()
  })

  it('deletes a non-installment transaction directly', async () => {
    const user = userEvent.setup()
    await seedAccount('Conta Remover')
    renderPage()

    await within(screen.getByLabelText('Conta ou cartão')).findByRole('option', { name: 'Conta Remover' })
    await user.type(screen.getByLabelText('Valor'), '20')
    await user.type(screen.getByLabelText('Descrição'), 'Para remover')
    await user.selectOptions(screen.getByLabelText('Conta ou cartão'), 'Conta Remover')
    await user.click(screen.getByRole('button', { name: 'Lançar' }))
    await screen.findByText(/Para remover/)

    await user.click(screen.getByRole('button', { name: 'Remover' }))
    await user.click(screen.getByRole('button', { name: 'Confirmar remoção' }))

    await waitFor(() => {
      expect(screen.getByText('Nenhum lançamento encontrado.')).toBeInTheDocument()
    })
  })

  it('blocks editing and removing a transaction whose invoice is no longer open', async () => {
    const user = userEvent.setup()
    const card = await createCard({ name: 'Cartão Bloqueado', creditLimit: 1000, closingDay: 10, dueDay: 20 })
    await createTransaction({
      type: 'expense',
      amount: 20,
      date: '2020-01-15',
      description: 'Compra antiga',
      cardId: card.id,
    })
    renderPage()
    await screen.findByText(/Compra antiga/)

    await user.click(screen.getByRole('button', { name: 'Editar' }))
    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(
      await screen.findByText('This transaction belongs to an invoice that is no longer open')
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    await user.click(screen.getByRole('button', { name: 'Remover' }))
    await user.click(screen.getByRole('button', { name: 'Confirmar remoção' }))
    expect(
      await screen.findByText('This transaction belongs to an invoice that is no longer open')
    ).toBeInTheDocument()
    expect(screen.getByText(/Compra antiga/)).toBeInTheDocument()
  })

  it('asks for confirmation before changing the amount of an already-paid invoice', async () => {
    const user = userEvent.setup()
    const [bank] = await listBanks()
    const account = await createAccount({ name: 'Conta Pagadora', bankId: bank!.id, initialBalance: 1000 })
    const card = await createCard({ name: 'Cartão Pago', creditLimit: 1000, closingDay: 10, dueDay: 20 })
    await createTransaction({
      type: 'expense',
      amount: 30,
      date: '2024-03-05',
      description: 'Primeira compra',
      cardId: card.id,
    })
    const [invoice] = await listInvoicesForCard(card.id)
    await payInvoice(invoice!.id, { accountId: account.id })

    renderPage()
    await within(screen.getByLabelText('Conta ou cartão')).findByRole('option', { name: 'Cartão Pago' })
    await user.type(screen.getByLabelText('Valor'), '10')
    await user.type(screen.getByLabelText('Descrição'), 'Retroativa')
    await user.selectOptions(screen.getByLabelText('Conta ou cartão'), 'Cartão Pago')
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: '2024-03-20' } })
    await user.click(screen.getByRole('button', { name: 'Lançar' }))

    expect(await screen.findByRole('alertdialog')).toHaveTextContent('R$30 será atualizado para R$40')

    await user.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(await screen.findByText(/Retroativa/)).toBeInTheDocument()
  })
})
