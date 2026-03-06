import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Use relative paths for Electron file:// protocol
  server: {
    port: 3000,
    strictPort: true
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: false,
    cssCodeSplit: true,
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-crop': ['react-image-crop']
        }
      },
      treeshake: {
        moduleSideEffects: false,
        propertyReadSideEffects: false
      }
    }
  }
})
