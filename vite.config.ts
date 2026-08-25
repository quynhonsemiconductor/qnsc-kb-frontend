import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_API_TARGET || 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      // Resolved from this module's own URL rather than `__dirname`. `__dirname` only
      // exists because Vite currently loads this config through a CJS-shimmed bundler;
      // it is absent under the native ESM loader that becomes the default in a future
      // major, which is what the startup warning was about. The URL form needs no shim
      // and, unlike `import.meta.dirname`, does not require Node >= 20.11 — the Docker
      // build runs on the floating `node:20-alpine` tag.
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
