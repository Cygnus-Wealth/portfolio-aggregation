import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/tests/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/tests/',
        '*.config.ts',
        '**/*.d.ts',
        '**/*.spec.ts',
        '**/*.test.ts'
      ]
    }
  },
  resolve: {
    alias: {
      '@': '/src',
      '@domain': '/src/domain',
      '@application': '/src/application',
      '@infrastructure': '/src/infrastructure',
      '@presentation': '/src/presentation',
      '@contracts': '/src/contracts',
      '@shared': '/src/shared'
    }
  }
})