import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
