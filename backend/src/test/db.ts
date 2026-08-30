import { PrismaClient } from '@prisma/client'

export const prismaTest = new PrismaClient()

// Shared catalog tables (seeded via migration, not created per-test) are excluded from the
// truncate — they aren't test-owned data that needs isolation between tests.
const CATALOG_TABLES = ['banks']

export async function resetDatabase(): Promise<void> {
  const tables = await prismaTest.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename != '_prisma_migrations'
  `
  const toTruncate = tables.filter((t) => !CATALOG_TABLES.includes(t.tablename))
  if (toTruncate.length === 0) return
  const names = toTruncate.map((t) => `"${t.tablename}"`).join(', ')
  await prismaTest.$executeRawUnsafe(`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`)
}
