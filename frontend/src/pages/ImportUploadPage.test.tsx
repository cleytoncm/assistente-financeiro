import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'
import { ImportUploadPage } from './ImportUploadPage'
import { ImportHistoryPage } from './ImportHistoryPage'
import { createAccount } from '../accounts/accountsApi'
import { createCard } from '../cards/cardsApi'
import { listBanks } from '../banks/banksApi'

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/importacoes/nova']}>
      <Routes>
        <Route path="/importacoes/nova" element={<ImportUploadPage />} />
        <Route
          path="/importacoes/:id"
          element={
            <p>
              Detalhe da importação — <Link to="/importacoes">Voltar</Link>
            </p>
          }
        />
        <Route path="/importacoes" element={<ImportHistoryPage />} />
      </Routes>
    </MemoryRouter>
  )
}

async function seedAccount(name: string) {
  const [bank] = await listBanks()
  return createAccount({ name, bankId: bank!.id, initialBalance: 0 })
}

function csvFile(content: string, name = 'extrato.csv'): File {
  return new File([content], name, { type: 'text/csv' })
}

describe('ImportUploadPage', () => {
  it('uploads a file and navigates to the batch detail page', async () => {
    const user = userEvent.setup()
    await seedAccount('Conta Import')
    renderPage()

    await within(screen.getByLabelText('Conta')).findByRole('option', { name: 'Conta Import' })
    await user.selectOptions(screen.getByLabelText('Conta'), 'Conta Import')
    await user.upload(
      screen.getByLabelText('Arquivo'),
      csvFile('2024-01-10,Mercado,50,expense')
    )
    await user.click(screen.getByRole('button', { name: 'Enviar' }))

    expect(await screen.findByText(/Detalhe da importação/)).toBeInTheDocument()
  })

  it('only offers cards as destination when pdf_invoice is selected', async () => {
    const user = userEvent.setup()
    await seedAccount('Conta PDF')
    await createCard({ name: 'Cartão PDF', creditLimit: 1000, closingDay: 10, dueDay: 20 })
    renderPage()

    await user.selectOptions(screen.getByLabelText('Formato'), 'pdf_invoice')
    expect(screen.getByLabelText('Cartão')).toBeInTheDocument()
    await within(screen.getByLabelText('Cartão')).findByRole('option', { name: 'Cartão PDF' })
    expect(screen.queryByRole('option', { name: 'Conta PDF' })).not.toBeInTheDocument()
  })

  it('warns about an identical already-imported file and allows confirming anyway', async () => {
    const user = userEvent.setup()
    await seedAccount('Conta Duplicada')
    renderPage()

    await within(screen.getByLabelText('Conta')).findByRole('option', { name: 'Conta Duplicada' })
    await user.selectOptions(screen.getByLabelText('Conta'), 'Conta Duplicada')
    await user.selectOptions(screen.getByLabelText('Modo'), 'direct')
    const content = '2024-02-01,Salário,1000,income'
    await user.upload(screen.getByLabelText('Arquivo'), csvFile(content))
    await user.click(screen.getByRole('button', { name: 'Enviar' }))
    await screen.findByText(/Detalhe da importação/)

    await user.click(screen.getByRole('link', { name: 'Voltar' }))
    await user.click(screen.getByRole('link', { name: 'Nova importação' }))
    await within(screen.getByLabelText('Conta')).findByRole('option', { name: 'Conta Duplicada' })
    await user.selectOptions(screen.getByLabelText('Conta'), 'Conta Duplicada')
    await user.upload(screen.getByLabelText('Arquivo'), csvFile(content))
    await user.click(screen.getByRole('button', { name: 'Enviar' }))

    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Importar mesmo assim' }))
    expect(await screen.findByText(/Detalhe da importação/)).toBeInTheDocument()
  })
})
