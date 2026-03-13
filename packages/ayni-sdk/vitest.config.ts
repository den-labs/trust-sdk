import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'lcov'],
      include: ['src/**'],
      exclude: ['**/__tests__/**', '**/*.d.ts'],
    },
  },
})
