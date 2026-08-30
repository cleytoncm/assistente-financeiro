import { test, expect } from '@playwright/test'

test('cadastro completo e login', async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`

  await page.goto('/cadastro')
  await page.getByLabel('Nome').fill('Ana E2E')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill('password123')
  await page.getByRole('button', { name: /criar conta/i }).click()

  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible()
  await expect(page.getByText('Conta criada com sucesso')).toBeVisible()

  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill('password123')
  await page.getByRole('button', { name: /^entrar$/i }).click()

  await expect(page.getByText(`Olá, Ana E2E (${email})`)).toBeVisible()
})

test('bloqueia acesso à home sem login e redireciona', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible()
})
