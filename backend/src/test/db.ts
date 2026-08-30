import { PrismaClient } from '@prisma/client'

export const prismaTest = new PrismaClient()

// Shared catalog tables (seeded via migration, not created per-test) are excluded from the
// truncate — they aren't test-owned data that needs isolation between tests.
const CATALOG_TABLES = ['banks']

const SEED_CATEGORIES: Array<{ name: string; type: 'income' | 'expense' }> = [
  { name: 'Salário', type: 'income' },
  { name: 'Freelance', type: 'income' },
  { name: 'Investimentos', type: 'income' },
  { name: 'Outras receitas', type: 'income' },
  { name: 'Alimentação', type: 'expense' },
  { name: 'Transporte', type: 'expense' },
  { name: 'Moradia', type: 'expense' },
  { name: 'Saúde', type: 'expense' },
  { name: 'Educação', type: 'expense' },
  { name: 'Lazer', type: 'expense' },
  { name: 'Compras', type: 'expense' },
  { name: 'Contas e serviços', type: 'expense' },
  { name: 'Outras despesas', type: 'expense' },
]

export async function resetDatabase(): Promise<void> {
  const tables = await prismaTest.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename != '_prisma_migrations'
  `
  const toTruncate = tables.filter((t) => !CATALOG_TABLES.includes(t.tablename))
  if (toTruncate.length > 0) {
    const names = toTruncate.map((t) => `"${t.tablename}"`).join(', ')
    // CASCADE also wipes `categories` (it has a nullable FK to `users`, which is truncated
    // here), even though it's meant to be a shared catalog like `banks` — re-seeded below.
    await prismaTest.$executeRawUnsafe(`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`)
  }

  await prismaTest.category.createMany({
    data: SEED_CATEGORIES.map((c) => ({ userId: null, name: c.name, type: c.type })),
    skipDuplicates: true,
  })
}
