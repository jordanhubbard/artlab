import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          tone: ['tone'],
          gsap: ['gsap'],
        }
      }
    }
  },
  server: {
    port: 5173,
    host: true,
    open: true
  },
  assetsInclude: ['**/*.glsl'],
  optimizeDeps: {
    exclude: ['three']
  }
})
