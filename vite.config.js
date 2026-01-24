import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Needed for Docker
    allowedHosts: process.env.ALLOWED_HOSTS 
      ? (process.env.ALLOWED_HOSTS === 'true' ? true : process.env.ALLOWED_HOSTS.split(','))
      : undefined,
    watch: {
      usePolling: true, // Needed for Windows file system in Docker
    },
    proxy: {
      '/api': {
        target: process.env.API_TARGET || 'http://localhost:5001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  },
  test: {
    globals: true,
    environment: "jsdom",
  }
})
