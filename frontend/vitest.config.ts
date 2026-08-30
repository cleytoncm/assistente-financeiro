import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// NOTE: run tests via `npm test` (not `npx vitest` directly). Node's own native Web Storage
// API (stable since Node 24+) shadows jsdom's window-scoped localStorage/sessionStorage with a
// non-functional stub unless the process is started with --no-experimental-webstorage — that
// flag has to be set before Node boots, so it lives in the NODE_OPTIONS env var in package.json
// scripts, not here.

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    environmentOptions: {
      jsdom: { url: 'http://localhost:3000/' },
    },
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['**/node_modules/**', '**/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/mocks/**', 'src/main.tsx', 'src/vite-env.d.ts'],
    },
  },
})
