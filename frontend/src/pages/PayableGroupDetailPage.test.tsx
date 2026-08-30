import { describe, expect, it } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { PayableGroupDetailPage } from './PayableGroupDetailPage'
import { createPayableGroup, listPayableGroups, type CreatePayableGroupInput } from '../payables/payableGroupsApi'
import { listBanks } from '../banks/banksApi'
import { createAccount } from '../accounts/accountsApi'

function renderPage(groupId: string) {
  return render(
    <MemoryRouter initialEntries={[`/contas-a-pagar/grupos/${groupId}`]}>
      <Routes>
        <Route path="/contas-a-pagar/grupos/:groupId" element={<PayableGroupDetailPage />} />
        <Route path="/contas-a-pagar" element={<p>Lista de contas a pagar</p>} />
      </Routes>
    </MemoryRouter>
  )
}

async function seedAccount(name: string) {
  const [bank] = await listBanks()
  return createAccount({ name, bankId: bank!.id, initialBalance: 0 })
}

async function seedGroup(overrides: Partial<CreatePayableGroupInput> = {}) {
  return createPayableGroup({
    type: 'expense',
    recurrenceType: 'installment',
    amount: 200,
    dueDay: 10,
    startDate: '2099-01-05',
    installmentCount: 3,
    description: 'Financiamento moto',
    ...overrides,
  })
}

describe('PayableGroupDetailPage', () => {
  it('shows group data and its parcelas', async () => {
    const group = await seedGroup()
    renderPage(group.id)

    expect(await screen.findByRole('heading', { name: 'Financiamento moto' })).toBeInTheDocument()
    const items = await screen.findAllByRole('listitem')
    const parcelas = items.filter((li) => li.textContent?.includes('parcela'))
    expect(parcelas).toHaveLength(3)
  })

  it('edits the group and cascades to unpaid parcelas', async () => {
    const user = userEvent.setup()
    const group = await seedGroup()
    renderPage(group.id)

    await screen.findByRole('heading', { name: 'Financiamento moto' })
    const amountInput = screen.getByLabelText('Valor por parcela')
    await user.clear(amountInput)
    await user.type(amountInput, '250')
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    await screen.findByDisplayValue('250')
    const updated = await listPayableGroups()
    expect(updated.find((g) => g.id === group.id)?.amount).toBe('250')
  })

  it('closes the group with scope=pending, keeping paid parcelas', async () => {
    const user = userEvent.setup()
    await seedAccount('Conta Encerramento')
    const group = await seedGroup({ description: 'Assinatura a encerrar' })
    renderPage(group.id)

    await screen.findByRole('heading', { name: 'Assinatura a encerrar' })
    const firstItem = (await screen.findAllByRole('listitem')).find((li) => li.textContent?.includes('parcela 1'))!
    await user.click(within(firstItem).getByRole('button', { name: 'Pagar' }))
    await user.selectOptions(within(firstItem).getByLabelText('Conta'), 'Conta Encerramento')
    await user.click(within(firstItem).getByRole('button', { name: 'Confirmar pagamento' }))
    await within(firstItem).findByText(/Paga/)

    await user.click(screen.getByRole('button', { name: 'Encerrar grupo' }))
    expect(await screen.findByText('Lista de contas a pagar')).toBeInTheDocument()
  })

  it('requires confirmation to close scope=all when a parcela is already paid', async () => {
    const user = userEvent.setup()
    await seedAccount('Conta Total')
    const group = await seedGroup({ description: 'Encerrar tudo' })
    renderPage(group.id)

    await screen.findByRole('heading', { name: 'Encerrar tudo' })
    const firstItem = (await screen.findAllByRole('listitem')).find((li) => li.textContent?.includes('parcela 1'))!
    await user.click(within(firstItem).getByRole('button', { name: 'Pagar' }))
    await user.selectOptions(within(firstItem).getByLabelText('Conta'), 'Conta Total')
    await user.click(within(firstItem).getByRole('button', { name: 'Confirmar pagamento' }))
    await within(firstItem).findByText(/Paga/)

    fireEvent.change(screen.getByLabelText('Escopo'), { target: { value: 'all' } })
    await user.click(screen.getByRole('button', { name: 'Encerrar grupo' }))

    expect(await screen.findByRole('alertdialog')).toHaveTextContent('1 parcela(s) paga(s)')
    await user.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(await screen.findByText('Lista de contas a pagar')).toBeInTheDocument()
  })
})
