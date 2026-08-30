import { config } from 'dotenv'

// This file must have no other imports and must run before any module that constructs a
// PrismaClient. @prisma/client auto-loads `.env` as a side effect of instantiation, and
// PrismaClient reads DATABASE_URL at construction time — so env vars must be finalized here
// first, or a client could end up permanently bound to the dev database instead of the test one.
config({ path: '.env.test', override: true })
