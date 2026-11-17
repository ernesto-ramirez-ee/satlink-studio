/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// GitHub Pages serves the site from https://<user>.github.io/<repo>/.
// A relative base ('./') makes the build work under any repo name, as long as
// the app has a single page (no client-side router). See docs/DECISIONS.md D-003.
export default defineConfig({
  base: './',
  plugins: [react()],
  // satellite.js 7 ships an optional WebAssembly worker that uses top-level await,
  // which only the ES worker format supports. (We use its plain-JS SGP4.)
  worker: { format: 'es' },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
