import { test, expect } from '@playwright/test'

async function registerAndLogin(page: import('@playwright/test').Page) {
  const email = `e2e-accounts-${Date.now()}@example.com`
  await page.goto('/cadastro')
  await page.getByLabel('Nome').fill('Ana Contas')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill('password123')
  await page.getByRole('button', { name: /criar conta/i }).click()

  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible()
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill('password123')
  await page.getByRole('button', { name: /^entrar$/i }).click()
  await expect(page.getByText(/Olá, Ana Contas/)).toBeVisible()
}

test('cadastra conta e cartão vinculado, depois remove ambos', async ({ page }) => {
  await registerAndLogin(page)

  await page.getByRole('link', { name: 'Contas e Cartões' }).click()
  await expect(page.getByRole('heading', { name: 'Contas e Cartões' })).toBeVisible()

  await page.getByLabel('Nome da conta').fill('Conta E2E')
  await page.getByLabel('Saldo inicial').fill('500')
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'Conta E2E' })).toBeVisible()

  await page.getByLabel('Nome do cartão').fill('Cartão E2E')
  await page.getByLabel('Limite').fill('2000')
  await page.getByLabel('Conta vinculada (opcional)').selectOption({ label: 'Conta E2E' })
  await page.getByRole('button', { name: 'Criar cartão' }).click()
  const cardItem = page.getByRole('listitem').filter({ hasText: 'Cartão E2E' })
  await expect(cardItem).toContainText('vinculado a Conta E2E')

  page.on('dialog', (dialog) => dialog.accept())
  await cardItem.getByRole('button', { name: 'Remover' }).click()
  await expect(page.getByText('Nenhum cartão cadastrado.')).toBeVisible()

  await page.getByRole('listitem').filter({ hasText: 'Conta E2E' }).getByRole('button', { name: 'Remover' }).click()
  await expect(page.getByText('Nenhuma conta cadastrada.')).toBeVisible()
})
