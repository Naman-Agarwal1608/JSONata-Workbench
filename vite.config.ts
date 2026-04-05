import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  base: './',
  plugins: [vue()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/@codemirror') || id.includes('node_modules/@lezer')) {
            return 'codemirror'
          }
          if (id.includes('node_modules/jsonata') || id.includes('node_modules/@jsonhero/codemirror-lang-jsonata')) {
            return 'jsonata-runtime'
          }
        }
      }
    }
  }
})
