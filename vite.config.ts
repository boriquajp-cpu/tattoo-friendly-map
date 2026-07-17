import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Tattoo Map Japan',
        short_name: 'Tattoo Map',
        description: 'タトゥーOK・NG施設を口コミでリアルに確認',
        start_url: '/',
        display: 'standalone',
        background_color: '#f9fafb',
        theme_color: '#6366f1',
        lang: 'ja',
        icons: [
          {
            src: '/favicon.svg',
            type: 'image/svg+xml',
            sizes: 'any',
            purpose: 'any',
          },
          {
            src: '/favicon.svg',
            type: 'image/svg+xml',
            sizes: 'any',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // アプリシェル（JS/CSS/HTML）は事前キャッシュし、オフラインでも起動できるようにする
        globPatterns: ['**/*.{js,css,html,svg}'],
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
