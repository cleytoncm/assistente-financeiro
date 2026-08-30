import { describe, expect, it } from 'vitest'
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { PayablesPage } from './PayablesPage'
import { listBanks } from '../banks/banksApi'
import { createAccount } from '../accounts/accountsApi'
import { money } from '../test/money'

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/contas-a-pagar']}>
      <Routes>
        <Route path="/contas-a-pagar" element={<PayablesPage />} />
        <Route path="/contas-a-pagar/grupos/:groupId" element={<p>Detalhe do grupo</p>} />
      </Routes>
    </MemoryRouter>
  )
}

async function seedAccount(name: string) {
  const [bank] = await listBanks()
  return createAccount({ name, bankId: bank!.id, initialBalance: 0 })
}

function farFutureDate(): string {
  return '2099-06-15'
}

describe('PayablesPage', () => {
  it('creates a standalone payable and lists it', async () => {
    const user = userEvent.setup()
    renderPage()

    await waitFor(() => expect(screen.getByText('Nenhuma conta avulsa cadastrada.')).toBeInTheDocument())
    await user.type(screen.getByLabelText(/^Valor/), '150')
    const dueDateInput = screen.getByLabelText('Vencimento')
    fireEvent.change(dueDateInput, { target: { value: farFutureDate() } })
    await user.type(screen.getByLabelText('Descrição (opcional)'), 'Conserto do carro')
    await user.click(screen.getByRole('button', { name: 'Cadastrar' }))

    expect(await screen.findByText(/Conserto do carro/)).toBeInTheDocument()
  })

  it('creates an installment group and lists it under Grupos', async () => {
    const user = userEvent.setup()
    renderPage()

    await waitFor(() => expect(screen.getByText('Nenhum grupo cadastrado.')).toBeInTheDocument())
    await user.selectOptions(screen.getByLabelText('Modo'), 'parcelada')
    await user.type(screen.getByLabelText(/^Valor/), '100')
    await user.clear(screen.getByLabelText('Quantidade de parcelas'))
    await user.type(screen.getByLabelText('Quantidade de parcelas'), '3')
    await user.type(screen.getByLabelText('Descrição (opcional)'), 'Financiamento geladeira')
    await user.click(screen.getByRole('button', { name: 'Cadastrar' }))

    const groupItem = await screen.findByText(/Financiamento geladeira/)
    expect(groupItem.closest('li')).toHaveTextContent('parcelada')
    expect(groupItem.closest('li')).toHaveTextContent('3 parcela(s)')
  })

  it('navigates to a group detail page', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.selectOptions(screen.getByLabelText('Modo'), 'recorrente')
    await user.type(screen.getByLabelText(/^Valor/), '1200')
    await user.type(screen.getByLabelText('Descrição (opcional)'), 'Aluguel')
    await user.click(screen.getByRole('button', { name: 'Cadastrar' }))

    await user.click(await screen.findByRole('link', { name: /Aluguel/ }))
    expect(await screen.findByText('Detalhe do grupo')).toBeInTheDocument()
  })

  it('pays a standalone payable and shows it as paga', async () => {
    const user = userEvent.setup()
    await seedAccount('Conta Pagadora')
    renderPage()

    await within(screen.getByLabelText('Conta sugerida (opcional)')).findByRole('option', {
      name: 'Conta Pagadora',
    })
    await user.type(screen.getByLabelText(/^Valor/), '80')
    const dueDateInput = screen.getByLabelText('Vencimento')
    fireEvent.change(dueDateInput, { target: { value: farFutureDate() } })
    await user.type(screen.getByLabelText('Descrição (opcional)'), 'Consulta médica')
    await user.click(screen.getByRole('button', { name: 'Cadastrar' }))
    const item = (await screen.findByText(/Consulta médica/)).closest('li')!

    await user.click(within(item).getByRole('button', { name: 'Pagar' }))
    await user.selectOptions(within(item).getByLabelText('Conta'), 'Conta Pagadora')
    await user.click(within(item).getByRole('button', { name: 'Confirmar pagamento' }))

    expect(await within(item).findByText(/Paga/)).toBeInTheDocument()
  })

  it('cancels a pending payable with an optional reason', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByLabelText(/^Valor/), '30')
    await user.type(screen.getByLabelText('Descrição (opcional)'), 'Assinatura teste')
    await user.click(screen.getByRole('button', { name: 'Cadastrar' }))
    const item = (await screen.findByText(/Assinatura teste/)).closest('li')!

    await user.click(within(item).getByRole('button', { name: 'Cancelar' }))
    await user.type(within(item).getByLabelText('Motivo (opcional)'), 'Não preciso mais')
    await user.click(within(item).getByRole('button', { name: 'Confirmar cancelamento' }))

    expect(await within(item).findByText(/Cancelada/)).toBeInTheDocument()
    expect(item).toHaveTextContent('Não preciso mais')
  })

  it('requires confirmation to cancel an already-paid payable', async () => {
    const user = userEvent.setup()
    await seedAccount('Conta X')
    renderPage()

    await within(screen.getByLabelText('Conta sugerida (opcional)')).findByRole('option', { name: 'Conta X' })
    await user.type(screen.getByLabelText(/^Valor/), '60')
    await user.type(screen.getByLabelText('Descrição (opcional)'), 'Pago e cancelado')
    await user.click(screen.getByRole('button', { name: 'Cadastrar' }))
    const item = (await screen.findByText(/Pago e cancelado/)).closest('li')!

    await user.click(within(item).getByRole('button', { name: 'Pagar' }))
    await user.selectOptions(within(item).getByLabelText('Conta'), 'Conta X')
    await user.click(within(item).getByRole('button', { name: 'Confirmar pagamento' }))
    await within(item).findByText(/Paga/)

    await user.click(within(item).getByRole('button', { name: 'Cancelar' }))
    await user.click(within(item).getByRole('button', { name: 'Confirmar cancelamento' }))
    expect(await within(item).findByRole('alertdialog')).toBeInTheDocument()
    await user.click(within(item).getByRole('button', { name: 'Confirmar' }))

    expect(await within(item).findByText(/Cancelada/)).toBeInTheDocument()
  })

  it('requires confirmation to delete an already-paid payable', async () => {
    const user = userEvent.setup()
    await seedAccount('Conta Excluir')
    renderPage()

    await within(screen.getByLabelText('Conta sugerida (opcional)')).findByRole('option', {
      name: 'Conta Excluir',
    })
    await user.type(screen.getByLabelText(/^Valor/), '45')
    await user.type(screen.getByLabelText('Descrição (opcional)'), 'Pago e excluído')
    await user.click(screen.getByRole('button', { name: 'Cadastrar' }))
    const item = (await screen.findByText(/Pago e excluído/)).closest('li')!

    await user.click(within(item).getByRole('button', { name: 'Pagar' }))
    await user.selectOptions(within(item).getByLabelText('Conta'), 'Conta Excluir')
    await user.click(within(item).getByRole('button', { name: 'Confirmar pagamento' }))
    await within(item).findByText(/Paga/)

    await user.click(within(item).getByRole('button', { name: 'Excluir' }))
    expect(await within(item).findByRole('alertdialog')).toBeInTheDocument()
    await user.click(within(item).getByRole('button', { name: 'Confirmar exclusão' }))

    await waitFor(() => {
      expect(screen.queryByText(/Pago e excluído/)).not.toBeInTheDocument()
    })
  })

  it('deletes a pending payable', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByLabelText(/^Valor/), '15')
    await user.type(screen.getByLabelText('Descrição (opcional)'), 'Para excluir')
    await user.click(screen.getByRole('button', { name: 'Cadastrar' }))
    await screen.findByText(/Para excluir/)

    const item = screen.getByText(/Para excluir/).closest('li')!
    await user.click(within(item).getByRole('button', { name: 'Excluir' }))

    await waitFor(() => {
      expect(screen.queryByText(/Para excluir/)).not.toBeInTheDocument()
    })
  })

  it('shows the projected total payable/receivable for the selected date', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByLabelText(/^Valor/), '500')
    const dueDateInput = screen.getByLabelText('Vencimento')
    fireEvent.change(dueDateInput, { target: { value: farFutureDate() } })
    await user.type(screen.getByLabelText('Descrição (opcional)'), 'Grande despesa futura')
    await user.click(screen.getByRole('button', { name: 'Cadastrar' }))
    await screen.findByText(/Grande despesa futura/)

    const untilInput = screen.getByLabelText('Total previsto até')
    fireEvent.change(untilInput, { target: { value: farFutureDate() } })

    expect(await screen.findByText(`A pagar: ${money(500)}`)).toBeInTheDocument()
  })
})
