import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { resolve } from "node:path"
import { treasuryDevPlugin } from "./vite-plugin-treasury-dev"

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), treasuryDevPlugin()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/tesseract.js')) {
            return 'tesseract';
          }
          if (id.includes('passportVerification')) {
            return 'passport-verify';
          }
        },
      },
    },
  },
  server: {
    fs: {
      allow: ['..']
    }
  },
  define: {
    global: 'window',
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: [],
  },
})