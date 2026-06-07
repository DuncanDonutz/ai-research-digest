import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/digest': {
        // In Docker this is overridden by API_TARGET env var pointing to the backend service
        target: process.env.API_TARGET || 'http://localhost:8000',
        changeOrigin: true,
      }
    }
  }
})
