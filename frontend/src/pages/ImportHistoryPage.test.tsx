import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ImportHistoryPage } from './ImportHistoryPage'
import { createAccount } from '../accounts/accountsApi'
import { listBanks } from '../banks/banksApi'
import { createImportBatch } from '../imports/importsApi'

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/importacoes']}>
      <Routes>
        <Route path="/importacoes" element={<ImportHistoryPage />} />
        <Route path="/importacoes/nova" element={<p>Nova importação</p>} />
        <Route path="/importacoes/:id" element={<p>Detalhe da importação</p>} />
      </Routes>
    </MemoryRouter>
  )
}

async function seedAccount(name: string) {
  const [bank] = await listBanks()
  return createAccount({ name, bankId: bank!.id, initialBalance: 0 })
}

function csvFile(content: string): File {
  return new File([content], 'extrato.csv', { type: 'text/csv' })
}

describe('ImportHistoryPage', () => {
  it('shows an empty state with no import batches', async () => {
    renderPage()
    expect(await screen.findByText('Nenhuma importação realizada ainda.')).toBeInTheDocument()
  })

  it('lists a batch with its format, destination and status', async () => {
    const account = await seedAccount('Conta Histórico')
    await createImportBatch({
      file: csvFile('2024-01-10,Mercado,50,expense'),
      format: 'csv',
      mode: 'direct',
      accountId: account.id,
    })

    renderPage()

    const item = await screen.findByText(/Conta Histórico/)
    expect(item.closest('li')).toHaveTextContent('CSV')
    expect(item.closest('li')).toHaveTextContent('Concluído')
  })

  it('navigates to the batch detail page', async () => {
    const user = userEvent.setup()
    const account = await seedAccount('Conta Navegação')
    await createImportBatch({
      file: csvFile('2024-01-10,Mercado,50,expense'),
      format: 'csv',
      mode: 'staged',
      accountId: account.id,
    })

    renderPage()
    await user.click(await screen.findByRole('link', { name: /Conta Navegação/ }))
    expect(await screen.findByText('Detalhe da importação')).toBeInTheDocument()
  })

  it('links to the upload page', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('link', { name: 'Nova importação' }))
    expect(await screen.findByText('Nova importação')).toBeInTheDocument()
  })
})
