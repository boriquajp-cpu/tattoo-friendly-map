import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon-32.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Tattour',
        short_name: 'Tattour',
        description: 'タトゥーOK・NG施設を口コミでリアルに確認',
        start_url: '/',
        display: 'standalone',
        background_color: '#f9fafb',
        theme_color: '#0f172a',
        lang: 'ja',
        icons: [
          {
            src: '/icon-192.png',
            type: 'image/png',
            sizes: '192x192',
            purpose: 'any',
          },
          {
            src: '/icon-512.png',
            type: 'image/png',
            sizes: '512x512',
            purpose: 'any',
          },
          {
            src: '/icon-maskable-512.png',
            type: 'image/png',
            sizes: '512x512',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // アプリシェル（JS/CSS/HTML）は事前キャッシュし、オフラインでも起動できるようにする
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            // Supabase REST（施設一覧など）は stale-while-revalidate でオフライン閲覧を許容する
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'supabase-rest-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // 地図タイル・フォントはキャッシュ優先で通信量を抑える
            urlPattern: /^https:\/\/tiles\.openfreemap\.org\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-tiles-cache',
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    // react-map-gl v8 はサブパス exports のみ提供するため、
    // rolldown が "module" / "import" 条件で正しく解決できるよう明示する
    conditions: ['module', 'browser', 'import', 'default'],
  },
  optimizeDeps: {
    include: ['maplibre-gl'],
  },
})
