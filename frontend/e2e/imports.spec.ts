import { test, expect } from '@playwright/test'

async function registerAndLogin(page: import('@playwright/test').Page, name: string) {
  const email = `e2e-imports-${Date.now()}@example.com`
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

test('importa um CSV em modo staged, revisa e confirma, criando o lançamento', async ({ page }) => {
  await registerAndLogin(page, 'Ana Importacoes')

  await page.getByRole('link', { name: 'Contas e Cartões' }).click()
  await page.getByLabel('Nome da conta').fill('Conta E2E Import')
  await page.getByLabel('Saldo inicial').fill('500')
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'Conta E2E Import' })).toBeVisible()

  await page.getByRole('link', { name: 'Voltar' }).click()
  await page.getByRole('link', { name: 'Importações' }).click()
  await page.getByRole('link', { name: 'Nova importação' }).click()

  await page.getByLabel('Formato').selectOption('csv')
  await page.getByLabel('Conta').selectOption({ label: 'Conta E2E Import' })
  await page.setInputFiles('#import-file', {
    name: 'extrato.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('2024-01-10,Mercado E2E,50,expense', 'utf-8'),
  })
  await page.getByRole('button', { name: 'Enviar' }).click()

  await expect(page.getByRole('heading', { name: 'Importação CSV' })).toBeVisible()
  await expect(page.getByLabel(/Descrição de Mercado E2E/)).toBeVisible({ timeout: 10000 })

  await page.getByRole('button', { name: 'Confirmar importação' }).click()
  await expect(page.getByText('Importação concluída.')).toBeVisible()

  await page.getByRole('link', { name: 'Voltar' }).click()
  await page.getByRole('link', { name: 'Voltar' }).click()
  await page.getByRole('link', { name: 'Lançamentos' }).click()
  await expect(page.getByText('Mercado E2E')).toBeVisible()

  await page.getByRole('link', { name: 'Voltar' }).click()
  await page.getByRole('link', { name: 'Contas e Cartões' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'saldo 450' })).toBeVisible()
})
