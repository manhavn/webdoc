import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiBase = env.VITE_API_BASE || '/api'

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        [apiBase]: 'http://127.0.0.1:18620',
        '/uploads': 'http://127.0.0.1:18620',
      },
    },
    build: {
      outDir: 'dist',
      chunkSizeWarningLimit: 1200,
    },
  }
})
