import { config } from 'dotenv'

/* v8 ignore start -- exercised only outside test mode, not reachable from the test suite */
if (process.env.NODE_ENV !== 'test') {
  config()
}
/* v8 ignore stop */

function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export const env = {
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  port: Number(process.env.PORT ?? 3000),
}
