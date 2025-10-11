import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'PortfolioAggregation',
      fileName: 'index',
      formats: ['es']
    },
    rollupOptions: {
      external: [
        '@cygnus-wealth/data-models',
        '@cygnus-wealth/evm-integration',
        '@cygnus-wealth/sol-integration',
        '@cygnus-wealth/robinhood-integration',
        '@cygnus-wealth/asset-valuator',
        'events'
      ],
      output: {
        globals: {
          events: 'Events'
        }
      }
    },
    sourcemap: true,
    minify: false // Don't minify for easier debugging
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@domain': resolve(__dirname, './src/domain'),
      '@application': resolve(__dirname, './src/application'),
      '@infrastructure': resolve(__dirname, './src/infrastructure'),
      '@contracts': resolve(__dirname, './src/contracts'),
      '@shared': resolve(__dirname, './src/shared')
    }
  }
});