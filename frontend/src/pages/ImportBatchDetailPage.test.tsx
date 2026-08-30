import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ImportBatchDetailPage } from './ImportBatchDetailPage'
import { createAccount } from '../accounts/accountsApi'
import { listBanks } from '../banks/banksApi'
import { createImportBatch } from '../imports/importsApi'

function renderPage(batchId: string) {
  return render(
    <MemoryRouter initialEntries={[`/importacoes/${batchId}`]}>
      <Routes>
        <Route path="/importacoes/:id" element={<ImportBatchDetailPage />} />
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

describe('ImportBatchDetailPage', () => {
  it('shows pending rows for a staged batch, edits and confirms', async () => {
    const user = userEvent.setup()
    const account = await seedAccount('Conta Revisão')
    const batch = await createImportBatch({
      file: csvFile('2024-01-10,Mercado,50,expense'),
      format: 'csv',
      mode: 'staged',
      accountId: account.id,
    })

    renderPage(batch.id)

    await screen.findByDisplayValue('Mercado')
    const descriptionInput = screen.getByLabelText('Descrição de Mercado')
    await user.clear(descriptionInput)
    await user.type(descriptionInput, 'Mercado Central')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    await screen.findByDisplayValue('Mercado Central')

    await user.click(screen.getByRole('button', { name: 'Confirmar importação' }))
    expect(await screen.findByText('Importação concluída.')).toBeInTheDocument()
  })

  it('discards a pending row', async () => {
    const user = userEvent.setup()
    const account = await seedAccount('Conta Descarte')
    const batch = await createImportBatch({
      file: csvFile('2024-01-10,Padaria,20,expense'),
      format: 'csv',
      mode: 'staged',
      accountId: account.id,
    })

    renderPage(batch.id)

    await screen.findByDisplayValue('Padaria')
    await user.click(screen.getByRole('button', { name: 'Descartar' }))
    await user.click(screen.getByRole('button', { name: 'Confirmar importação' }))
    expect(await screen.findByText('Importação concluída.')).toBeInTheDocument()
  })

  it('shows accepted count and no review table when everything auto-accepted in direct mode', async () => {
    const account = await seedAccount('Conta Direta')
    const batch = await createImportBatch({
      file: csvFile('2024-01-10,Salário,1000,income'),
      format: 'csv',
      mode: 'direct',
      accountId: account.id,
    })

    renderPage(batch.id)

    expect(await screen.findByText('Importação concluída.')).toBeInTheDocument()
    expect(screen.getByText(/1 lançamento\(s\) já aceito\(s\) automaticamente\./)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirmar importação' })).not.toBeInTheDocument()
  })

  it('shows a failure message with the error for an unparsable file', async () => {
    const account = await seedAccount('Conta Falha')
    const batch = await createImportBatch({
      file: csvFile('linha invalida sem virgulas suficientes'),
      format: 'csv',
      mode: 'staged',
      accountId: account.id,
    })

    renderPage(batch.id)

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível processar o arquivo')
  })

  it('flags a suspect duplicate row visually', async () => {
    const account = await seedAccount('Conta Suspeita')
    // Create a manual transaction matching what the import will produce, to trigger suspicion.
    await createImportBatch({
      file: csvFile('2024-03-01,Aluguel,900,expense'),
      format: 'csv',
      mode: 'direct',
      accountId: account.id,
    })
    const batch = await createImportBatch({
      file: csvFile('2024-03-01,Aluguel (import),900,expense'),
      format: 'csv',
      mode: 'staged',
      accountId: account.id,
    })

    renderPage(batch.id)

    const item = (await screen.findByDisplayValue('Aluguel (import)')).closest('li')!
    expect(within(item).getByText(/possível duplicata/)).toBeInTheDocument()
  })
})
