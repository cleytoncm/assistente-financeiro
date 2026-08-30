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
  // Etapa 6: when set, CSV/PDF import extraction calls Vertex AI (Gemini) for real; otherwise a
  // deterministic fake extractor is used (local dev, tests). Vertex AI authenticates via the
  // Cloud Run service account (Application Default Credentials), not an API key.
  vertexAiProjectId: process.env.VERTEX_AI_PROJECT_ID,
  vertexAiLocation: process.env.VERTEX_AI_LOCATION ?? 'us-central1',
  // Etapa 6: shared secret the internal import-processing endpoint checks on every call,
  // standing in for Cloud Tasks' OIDC token validation until that's wired in production.
  internalTasksSecret: process.env.INTERNAL_TASKS_SECRET,
}
