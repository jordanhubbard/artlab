import { defineConfig } from 'vite'

export default defineConfig({
  // Multi-page: root index.html (IDE) + solar-system.html (standalone demo)
  build: {
    target: 'esnext',
    rollupOptions: {
      input: {
        main:        'index.html',
        solarSystem: 'solar-system.html',
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
