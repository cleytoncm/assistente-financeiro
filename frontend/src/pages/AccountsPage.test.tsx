import { describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AccountsPage } from './AccountsPage'
import { createTransaction } from '../transactions/transactionsApi'
import { listAccounts } from '../accounts/accountsApi'

function renderPage() {
  return render(
    <MemoryRouter>
      <AccountsPage />
    </MemoryRouter>
  )
}

describe('AccountsPage', () => {
  it('creates an account and lists it', async () => {
    const user = userEvent.setup()
    renderPage()

    await waitFor(() => expect(screen.getByText('Nenhuma conta cadastrada.')).toBeInTheDocument())
    await screen.findByRole('option', { name: 'Banco do Brasil' })

    await user.type(screen.getByLabelText('Nome da conta'), 'Conta Corrente')
    await user.clear(screen.getByLabelText('Saldo inicial'))
    await user.type(screen.getByLabelText('Saldo inicial'), '100')
    await user.click(screen.getByRole('button', { name: 'Criar conta' }))

    expect(await screen.findByRole('listitem')).toHaveTextContent(/Conta Corrente/)
  })

  it('registers a new bank inline and selects it', async () => {
    const user = userEvent.setup()
    renderPage()

    await waitFor(() => expect(screen.getByLabelText('Banco')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Cadastrar novo banco' }))
    await user.type(screen.getByLabelText('Nome do banco'), 'Banco Teste')
    await user.type(screen.getByLabelText('Código'), '999')
    await user.click(screen.getByRole('button', { name: 'Salvar banco' }))

    await waitFor(() => {
      const select = screen.getByLabelText('Banco') as HTMLSelectElement
      expect(within(select).getByText('Banco Teste')).toBeInTheDocument()
    })
  })

  it('creates a card without a linked account and lists it', async () => {
    const user = userEvent.setup()
    renderPage()

    await waitFor(() => expect(screen.getByText('Nenhum cartão cadastrado.')).toBeInTheDocument())

    await user.type(screen.getByLabelText('Nome do cartão'), 'Cartão Teste')
    await user.type(screen.getByLabelText('Limite'), '1000')
    await user.click(screen.getByRole('button', { name: 'Criar cartão' }))

    expect(await screen.findByText(/Cartão Teste/)).toBeInTheDocument()
    expect(screen.getByText(/sem vínculo/)).toBeInTheDocument()
  })

  it('deletes an account after confirmation', async () => {
    const user = userEvent.setup()
    window.confirm = () => true
    renderPage()

    await waitFor(() => expect(screen.getByText('Nenhuma conta cadastrada.')).toBeInTheDocument())
    await screen.findByRole('option', { name: 'Banco do Brasil' })
    await user.type(screen.getByLabelText('Nome da conta'), 'Conta a remover')
    await user.click(screen.getByRole('button', { name: 'Criar conta' }))
    await screen.findByRole('listitem')

    await user.click(screen.getByRole('button', { name: 'Remover' }))

    await waitFor(() => {
      expect(screen.getByText('Nenhuma conta cadastrada.')).toBeInTheDocument()
    })
  })

  it('toggles isActive and isHidden on an account', async () => {
    const user = userEvent.setup()
    renderPage()

    await waitFor(() => expect(screen.getByText('Nenhuma conta cadastrada.')).toBeInTheDocument())
    await screen.findByRole('option', { name: 'Banco do Brasil' })
    await user.type(screen.getByLabelText('Nome da conta'), 'Conta Toggle')
    await user.click(screen.getByRole('button', { name: 'Criar conta' }))
    await screen.findByRole('listitem')

    await user.click(screen.getByRole('button', { name: 'Desativar' }))
    expect(await screen.findByText(/inativa/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Ocultar' }))
    expect(await screen.findByText(/oculta/)).toBeInTheDocument()
  })

  it('shows the 3-option removal dialog when the account has transactions', async () => {
    const user = userEvent.setup()
    renderPage()

    await waitFor(() => expect(screen.getByText('Nenhuma conta cadastrada.')).toBeInTheDocument())
    await screen.findByRole('option', { name: 'Banco do Brasil' })
    await user.type(screen.getByLabelText('Nome da conta'), 'Conta Com Lancamento')
    await user.click(screen.getByRole('button', { name: 'Criar conta' }))
    await screen.findByRole('listitem')

    const accounts = await listAccounts()
    const account = accounts.find((a) => a.name === 'Conta Com Lancamento')!
    await createTransaction({
      type: 'expense',
      amount: 10,
      date: '2024-01-01',
      description: 'X',
      accountId: account.id,
    })

    await user.click(screen.getByRole('button', { name: 'Remover' }))

    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Excluir em cascata/ }))

    await waitFor(() => {
      expect(screen.getByText('Nenhuma conta cadastrada.')).toBeInTheDocument()
    })
  })
})
