import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // The app is served from https://<user>.github.io/Grimoire/, so assets must
  // be resolved relative to that subpath. Override to '/' if deploying to a
  // custom domain or a root-hosting static provider (Netlify, Vercel, etc.).
  base: '/Grimoire/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})