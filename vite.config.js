import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'icon.svg', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: 'meshRF',
        short_name: 'meshRF',
        description: 'Advanced RF Link Analysis and Mesh Planning',
        theme_color: '#0a0a0f',
        background_color: '#0a0a0f',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        orientation: 'portrait-primary',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api'),
            handler: 'NetworkOnly',
            options: {
              backgroundSync: {
                name: 'api-queue',
                options: {
                  maxRetentionTime: 24 * 60
                }
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: true,
        type: 'module'
      }
    })
  ],
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
  }},
  define: {
    'process.env': process.env
  },
  test: {
    globals: true,
    environment: "jsdom",
  }
})
