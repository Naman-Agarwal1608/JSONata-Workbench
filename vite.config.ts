import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    dedupe: [
      '@codemirror/state',
      '@codemirror/view',
      '@codemirror/commands',
      '@codemirror/language',
      '@codemirror/search',
      '@codemirror/lint',
      '@codemirror/autocomplete',
      '@codemirror/lang-json',
      '@codemirror/lang-javascript',
      '@codemirror/theme-one-dark',
      '@lezer/common',
      '@lezer/highlight',
      '@lezer/lr'
    ]
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/@codemirror/view') || id.includes('node_modules/@codemirror/state')) {
            return 'codemirror-core'
          }
          if (
            id.includes('node_modules/@codemirror/autocomplete') ||
            id.includes('node_modules/@codemirror/commands') ||
            id.includes('node_modules/@codemirror/language') ||
            id.includes('node_modules/@codemirror/search') ||
            id.includes('node_modules/@codemirror/lint') ||
            id.includes('node_modules/@codemirror/lang-json') ||
            id.includes('node_modules/@codemirror/lang-javascript') ||
            id.includes('node_modules/@codemirror/theme-one-dark') ||
            id.includes('node_modules/@lezer')
          ) {
            return 'codemirror-lang'
          }
          if (id.includes('node_modules/jsonata') || id.includes('node_modules/@jsonhero/codemirror-lang-jsonata')) {
            return 'jsonata-runtime'
          }
        }
      }
    }
  }
})
