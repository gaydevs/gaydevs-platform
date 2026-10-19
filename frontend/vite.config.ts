import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/gaydevs/platform/',
  server: {
    proxy: {
      '/gaydevs/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/gaydevs\/api/, ''),
      },
    },
  },
})
