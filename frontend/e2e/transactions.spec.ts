import { test, expect } from '@playwright/test'

async function registerAndLogin(page: import('@playwright/test').Page, name: string) {
  const email = `e2e-txn-${Date.now()}@example.com`
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

test('lança receita e despesa e vê refletido no saldo, depois remove em cascata', async ({ page }) => {
  await registerAndLogin(page, 'Ana Lancamentos')

  await page.getByRole('link', { name: 'Contas e Cartões' }).click()
  await page.getByLabel('Nome da conta').fill('Conta E2E Saldo')
  await page.getByLabel('Saldo inicial').fill('100')
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'Conta E2E Saldo' })).toBeVisible()

  await page.getByRole('link', { name: 'Voltar' }).click()
  await page.getByRole('link', { name: 'Lançamentos' }).click()

  const destinationSelect = page.getByLabel('Conta ou cartão')
  await expect(destinationSelect.getByRole('option', { name: 'Conta E2E Saldo' })).toBeAttached()

  await page.getByLabel('Valor').fill('50')
  await page.getByLabel('Descrição').fill('Salário E2E')
  await page.getByLabel('Tipo').selectOption('income')
  await destinationSelect.selectOption({ label: 'Conta E2E Saldo' })
  await page.getByRole('button', { name: 'Lançar' }).click()
  await expect(page.getByText('Salário E2E')).toBeVisible()

  await page.getByRole('link', { name: 'Voltar' }).click()
  await page.getByRole('link', { name: 'Contas e Cartões' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'saldo 150' })).toBeVisible()

  // Removing an account with transactions offers the 3-option dialog; cascade deletes both.
  await page.getByRole('listitem').filter({ hasText: 'Conta E2E Saldo' }).getByRole('button', { name: 'Remover' }).click()
  await expect(page.getByRole('alertdialog')).toBeVisible()
  await page.getByRole('button', { name: /Excluir em cascata/ }).click()
  await expect(page.getByText('Nenhuma conta cadastrada.')).toBeVisible()
})
