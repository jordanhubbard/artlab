import { defineConfig } from 'vite'

export default defineConfig({
  // Multi-page: root index.html (solar system) + ide.html (IDE)
  build: {
    target: 'esnext',
    rollupOptions: {
      input: {
        main: 'index.html',
        ide:  'ide.html',
      },
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
    open: true,
  },
  assetsInclude: ['**/*.glsl'],
  optimizeDeps: {
    exclude: ['three']
  }
})
