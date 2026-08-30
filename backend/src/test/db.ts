import { PrismaClient } from '@prisma/client'

export const prismaTest = new PrismaClient()

export async function resetDatabase(): Promise<void> {
  const tables = await prismaTest.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename != '_prisma_migrations'
  `
  if (tables.length === 0) return
  const names = tables.map((t) => `"${t.tablename}"`).join(', ')
  await prismaTest.$executeRawUnsafe(`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`)
}
