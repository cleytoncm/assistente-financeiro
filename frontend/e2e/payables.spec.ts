import { test, expect } from '@playwright/test'

async function registerAndLogin(page: import('@playwright/test').Page, name: string) {
  const email = `e2e-payables-${Date.now()}@example.com`
  await page.goto('/cadastro')
  await page.getByLabel('Nome').fill(name)
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill('password123')
  await page.getByRole('button', { name: /criar conta/i }).click()

  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible()
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill('password123')
  await page.getByRole('button', { name: /^entrar$/i }).click()
  await expect(page.getByText(new RegExp(`Olá, ${name}`))).toBeVisible()
}

test('cadastra conta a pagar avulsa, vê o saldo previsto cair, depois paga e vê o saldo real cair', async ({
  page,
}) => {
  await registerAndLogin(page, 'Ana Payables')

  await page.getByRole('link', { name: 'Contas e Cartões' }).click()
  await page.getByLabel('Nome da conta').fill('Conta E2E Payable')
  await page.getByLabel('Saldo inicial').fill('1000')
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'Conta E2E Payable' })).toBeVisible()

  await page.getByRole('link', { name: 'Voltar' }).click()
  await page.getByRole('link', { name: 'Contas a Pagar/Receber' }).click()

  await page.getByLabel(/^Valor/).fill('100')
  await page.getByLabel('Descrição (opcional)').fill('Conta de luz')
  await page.getByLabel('Conta sugerida (opcional)').selectOption({ label: 'Conta E2E Payable' })
  await page.getByRole('button', { name: 'Cadastrar' }).click()
  await expect(page.getByText('Conta de luz')).toBeVisible()
  await expect(page.getByText(/A pagar: 100/)).toBeVisible()

  await page.getByRole('link', { name: 'Voltar' }).click()
  await page.getByRole('link', { name: 'Contas e Cartões' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'saldo 1000' })).toBeVisible()
  await expect(page.getByRole('listitem').filter({ hasText: 'previsto 900' })).toBeVisible()

  await page.getByRole('link', { name: 'Voltar' }).click()
  await page.getByRole('link', { name: 'Contas a Pagar/Receber' }).click()
  const item = page.getByRole('listitem').filter({ hasText: 'Conta de luz' })
  await item.getByRole('button', { name: 'Pagar' }).click()
  await item.getByLabel('Conta', { exact: true }).selectOption({ label: 'Conta E2E Payable' })
  await item.getByRole('button', { name: 'Confirmar pagamento' }).click()
  await expect(item).toContainText('Paga')

  await page.getByRole('link', { name: 'Voltar' }).click()
  await page.getByRole('link', { name: 'Contas e Cartões' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'saldo 900' })).toBeVisible()
})
