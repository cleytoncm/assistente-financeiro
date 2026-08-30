import { test, expect } from '@playwright/test'

async function registerAndLogin(page: import('@playwright/test').Page, name: string) {
  const email = `e2e-invoices-${Date.now()}@example.com`
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

test('lança compra no cartão, vê a fatura gerada e paga debitando a conta vinculada', async ({ page }) => {
  await registerAndLogin(page, 'Ana Faturas')

  await page.getByRole('link', { name: 'Contas e Cartões' }).click()
  await page.getByLabel('Nome da conta').fill('Conta E2E Fatura')
  await page.getByLabel('Saldo inicial').fill('1000')
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'Conta E2E Fatura' })).toBeVisible()

  await page.getByLabel('Nome do cartão').fill('Cartão E2E Fatura')
  await page.getByLabel('Limite').fill('2000')
  await page.getByLabel('Conta vinculada (opcional)').selectOption({ label: 'Conta E2E Fatura' })
  await page.getByRole('button', { name: 'Criar cartão' }).click()
  const cardItem = page.getByRole('listitem').filter({ hasText: 'Cartão E2E Fatura' })
  await expect(cardItem).toContainText('vinculado a Conta E2E Fatura')

  await page.getByRole('link', { name: 'Voltar' }).click()
  await page.getByRole('link', { name: 'Lançamentos' }).click()
  const destinationSelect = page.getByLabel('Conta ou cartão')
  await expect(destinationSelect.getByRole('option', { name: 'Cartão E2E Fatura' })).toBeAttached()
  await page.getByLabel('Valor').fill('200')
  await page.getByLabel('Descrição').fill('Compra E2E Fatura')
  await destinationSelect.selectOption({ label: 'Cartão E2E Fatura' })
  await page.getByRole('button', { name: 'Lançar' }).click()
  await expect(page.getByText('Compra E2E Fatura')).toBeVisible()

  await page.getByRole('link', { name: 'Voltar' }).click()
  await page.getByRole('link', { name: 'Contas e Cartões' }).click()
  await cardItem.getByRole('link', { name: 'Ver faturas' }).click()

  await expect(page.getByRole('heading', { name: /Faturas/ })).toBeVisible()
  // With a default closing day of 1, a purchase made today almost always lands in next
  // month's invoice rather than the current (already-closed) one, so an empty intermediate
  // invoice for the current period is created alongside it (RF-01) — the transaction is
  // always in the last (most recent) invoice listed, not necessarily the first.
  const invoiceLink = page.getByRole('link', { name: /^\d{2}\/\d{4}$/ }).last()
  await invoiceLink.click()

  await expect(page.getByText(/Total: 200/)).toBeVisible()
  await expect(page.getByText('Compra E2E Fatura')).toBeVisible()
  await expect(page.getByLabel('Conta pagadora')).toHaveValue(/.+/)

  await page.getByRole('button', { name: /Pagar fatura/ }).click()
  await expect(page.getByText('Fatura paga.')).toBeVisible()
  await expect(page.getByText('Paga', { exact: true })).toBeVisible()

  await page.getByRole('link', { name: 'Voltar' }).click()
  await page.getByRole('link', { name: 'Voltar' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'saldo 800' })).toBeVisible()
})
