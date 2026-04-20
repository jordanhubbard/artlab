import { defineConfig }                          from 'vite'
import { copyFileSync, mkdirSync, readdirSync,
         statSync, existsSync }                   from 'fs'
import { join }                                   from 'path'

// Recursively copy src → dest, skipping dirs named __tests__.
function copyDir(src, dest) {
  mkdirSync(dest, { recursive: true })
  for (const entry of readdirSync(src)) {
    if (entry === '__tests__') continue
    const s = join(src, entry), d = join(dest, entry)
    statSync(s).isDirectory() ? copyDir(s, d) : copyFileSync(s, d)
  }
}

// Copy examples/ and the src modules that examples import at runtime
// so relative paths like ../../src/physics/Physics.js resolve in production.
const copyExamplesPlugin = {
  name: 'copy-examples',
  closeBundle() {
    if (existsSync('examples'))     copyDir('examples',     'dist/examples')
    if (existsSync('src/stdlib'))   copyDir('src/stdlib',   'dist/src/stdlib')
    if (existsSync('src/physics'))  copyDir('src/physics',  'dist/src/physics')
  },
}

// Inject <script type="importmap"> into every HTML page so that dynamically
// loaded example files can resolve bare specifiers ('three', 'tone') to the
// hashed chunk URLs that Vite emits.  Without this the browser rejects bare
// specifiers in raw static JS files that are not processed by Vite's bundler.
const importMapPlugin = {
  name: 'inject-import-map',
  apply: 'build',
  transformIndexHtml: {
    enforce: 'post',
    transform(html, ctx) {
      if (!ctx.bundle) return html
      const base = process.env.BASE_URL ?? '/'
      const imports = {}
      for (const [filename, chunk] of Object.entries(ctx.bundle)) {
        if (chunk.type !== 'chunk') continue
        if (chunk.name === 'three') imports['three'] = `${base}${filename}`
        if (chunk.name === 'tone')  imports['tone']  = `${base}${filename}`
      }
      if (!Object.keys(imports).length) return html
      const tag = `<script type="importmap">\n${JSON.stringify({ imports }, null, 2)}\n</script>`
      return html.replace('<head>', `<head>\n    ${tag}`)
    },
  },
}

export default defineConfig({
  // Set BASE_URL env var when building for a sub-path, e.g.
  //   BASE_URL=/artlab/ npm run build
  // Defaults to '/' for local dev and root-hosted deployments.
  base: process.env.BASE_URL ?? '/',

  plugins: [copyExamplesPlugin, importMapPlugin],

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
