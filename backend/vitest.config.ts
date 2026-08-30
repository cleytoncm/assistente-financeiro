import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    setupFiles: ['./src/test/env.setup.ts', './src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/test/**', 'src/server.ts'],
      // constitution.md mandates 90% line coverage; statements/functions naturally track lines
      // here. Branches is kept lower because a few remaining branches are trivial defensive
      // fallbacks (e.g. `?? 'default'` on values that are always populated in practice) that
      // aren't worth contriving tests for.
      thresholds: {
        lines: 90,
        statements: 90,
        functions: 90,
        branches: 80,
      },
    },
  },
})
