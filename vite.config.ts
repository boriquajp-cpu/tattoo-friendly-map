import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // react-map-gl v8 はサブパス exports のみ提供するため、
    // rolldown が "module" / "import" 条件で正しく解決できるよう明示する
    conditions: ['module', 'browser', 'import', 'default'],
  },
  optimizeDeps: {
    include: ['mapbox-gl'],
  },
})
