import { defineConfig }                          from 'vite'
import { copyFileSync, mkdirSync, readdirSync,
         statSync, existsSync }                   from 'fs'
import { join }                                   from 'path'

// Recursively copy src → dest after every production build so that
// /examples/** is present in dist/ and served on GitHub Pages.
function copyDir(src, dest) {
  mkdirSync(dest, { recursive: true })
  for (const entry of readdirSync(src)) {
    const s = join(src, entry), d = join(dest, entry)
    statSync(s).isDirectory() ? copyDir(s, d) : copyFileSync(s, d)
  }
}

const copyExamplesPlugin = {
  name: 'copy-examples',
  closeBundle() {
    if (existsSync('examples')) copyDir('examples', 'dist/examples')
  },
}

export default defineConfig({
  // Set BASE_URL env var when building for a sub-path, e.g.
  //   BASE_URL=/artlab/ npm run build
  // Defaults to '/' for local dev and root-hosted deployments.
  base: process.env.BASE_URL ?? '/',

  plugins: [copyExamplesPlugin],

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
          tone:  ['tone'],
          gsap:  ['gsap'],
        },
      },
    },
  },

  server: {
    port: 5173,
    host: true,
    open: true,
  },

  assetsInclude: ['**/*.glsl'],
  optimizeDeps: { exclude: ['three'] },
})
