import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/gaydevs/platform/',
  server: {
    // Permite testar o frontend em celulares e outros dispositivos da LAN.
    // O backend continua sendo acessado pelo proxy local abaixo.
    host: true,
    proxy: {
      '/gaydevs/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/gaydevs\/api/, ''),
      },
    },
  },
  preview: {
    // Mantém o mesmo comportamento quando a build é servida para validação.
    host: true,
  },
})
