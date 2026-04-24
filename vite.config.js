import { defineConfig }                          from 'vite'
import { build as esbuild }                       from 'esbuild'
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
  async closeBundle() {
    if (existsSync('examples'))     copyDir('examples',     'dist/examples')
    if (existsSync('src/stdlib'))   copyDir('src/stdlib',   'dist/src/stdlib')
    if (existsSync('src/physics'))  copyDir('src/physics',  'dist/src/physics')
    if (existsSync('src/audio'))    copyDir('src/audio',    'dist/src/audio')
    if (existsSync('src/assets'))   copyDir('src/assets',   'dist/src/assets')

    // Build standalone vendor ESM bundles that examples load via importmap.
    // Vite's internal chunks use minified export aliases, so they cannot be
    // consumed by dynamically loaded example files via importmap.  Instead we
    // produce self-contained bundles where the export names match the library's
    // public API (AmbientLight, Synth, etc.).
    mkdirSync('dist/vendors', { recursive: true })
    // Three.js ships a pre-built ESM — copy it directly.
    copyFileSync(
      'node_modules/three/build/three.module.min.js',
      'dist/vendors/three.esm.js',
    )
    // Tone.js only ships ESM sources, so we bundle them with esbuild.
    await esbuild({
      entryPoints: ['node_modules/tone/build/esm/index.js'],
      bundle:      true,
      format:      'esm',
      minify:      true,
      outfile:     'dist/vendors/tone.esm.js',
    })
    // three/addons — copy only the specific addon files used by static assets
    // (examples, stdlib, physics).  The importmap prefix "three/addons/" routes
    // all such imports here.  Add new entries as needed when examples grow.
    const jsm = 'node_modules/three/examples/jsm'
    const addons = 'dist/vendors/three-addons'
    mkdirSync(`${addons}/renderers`, { recursive: true })
    copyFileSync(`${jsm}/renderers/CSS2DRenderer.js`, `${addons}/renderers/CSS2DRenderer.js`)
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
      const imports = {
        'three':         `${base}vendors/three.esm.js`,
        'tone':          `${base}vendors/tone.esm.js`,
        // Prefix mapping: three/addons/X → vendors/three-addons/X
        // CSS2DRenderer.js is the only addon currently needed by static assets.
        'three/addons/': `${base}vendors/three-addons/`,
      }
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
        main: 'index.html',
      },
      output: {
        manualChunks: {
          three: ['three'],
        },
      },
    },
  },

  test: {
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
  },

  server: {
    port: 5173,
    host: true,
    open: true,
  },

  assetsInclude: ['**/*.glsl'],
  optimizeDeps: { exclude: ['three', 'manifold-3d'] },
})
