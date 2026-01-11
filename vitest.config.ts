import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    globals: true,
    environment: 'jsdom',
    environmentMatchGlobs: [
      ['src/lib/**/*.test.ts', 'node'],
      ['src/lib/**/*.test.tsx', 'node'],
      ['src/lib/**/*.spec.ts', 'node'],
      ['src/lib/**/*.spec.tsx', 'node'],
      ['src/db/**/*.test.ts', 'node'],
      ['src/db/**/*.spec.ts', 'node'],
    ],
    setupFiles: ['src/tests/setup-vitest.ts'],
    css: true,
    clearMocks: true,
    restoreMocks: true,
    reporters: process.env.CI ? ['dot', 'junit'] : ['default'],
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage/unit',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.{ts,tsx}'],
    },
  },
})

