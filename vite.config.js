import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Pin the dev port: the backend's CORS allow-list and the email
  // verification link both hard-code http://localhost:5173. strictPort
  // makes Vite fail loudly if 5173 is taken rather than silently moving
  // to 5174 (which would break CORS and the verify link).
  server: { port: 5173, strictPort: true },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
