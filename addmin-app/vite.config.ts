import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { wasp } from 'wasp/client/vite'

export default defineConfig({
  plugins: [wasp(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    open: true,
    // Dev-only: same-origin uploads (avoids CORS on multipart + Authorization preflight).
    proxy: {
      "/api/upload": {
        target: process.env.REACT_APP_API_URL ?? "http://localhost:3011",
        changeOrigin: true,
      },
    },
  },
})
