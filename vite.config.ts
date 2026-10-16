import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({ plugins: [react()], build: { sourcemap: false }, server: { proxy: {
  '/tables': 'http://127.0.0.1:8099',
  '/api': 'http://127.0.0.1:8099',
  '/media-proxy': 'http://127.0.0.1:8099',
}}})
