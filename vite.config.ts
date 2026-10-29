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

function exampleAssets(directory = 'examples') {
  const paths = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`
    if (entry.isDirectory()) paths.push(...exampleAssets(path))
    else if (path.includes('/assets/')) paths.push(path)
  }
  return paths
}

const assetCatalogPlugin = {
  name: 'example-asset-catalog',
  configureServer(server) {
    server.middlewares.use((request, response, next) => {
      if (!request.url?.split('?')[0].endsWith('/examples-assets.json')) return next()
      response.setHeader('Content-Type', 'application/json')
      response.end(JSON.stringify(exampleAssets()))
    })
  },
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'examples-assets.json', source: JSON.stringify(exampleAssets()) })
  },
}

// Copy examples/ and the src modules that examples import at runtime
// so relative paths like ../../src/physics/Physics.js resolve in production.
const copyExamplesPlugin = {
  name: 'copy-examples',
  async closeBundle() {
    if (existsSync('examples'))     copyDir('examples',     'dist/examples')
    if (existsSync('src/runtime')) copyDir('src/runtime', 'dist/src/runtime')
    if (existsSync('src/utils')) copyDir('src/utils', 'dist/src/utils')
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
    // Preserve addon-relative imports so every browsable Three helper can run.
    copyDir('node_modules/three/examples/jsm', 'dist/vendors/three-addons')
    copyFileSync('node_modules/@dimforge/rapier3d-compat/rapier.mjs', 'dist/vendors/rapier.mjs')

    // manifold-3d ships an ESM wrapper that detects browser vs. Node at runtime.
    // Copy it directly; bundling tries to resolve its guarded node:module import.
    // The Emscripten runtime resolves manifold.wasm relative to the module URL,
    // so both files must live in the same directory.
    copyFileSync(
      'node_modules/manifold-3d/manifold.js',
      'dist/vendors/manifold.esm.js',
    )
    copyFileSync(
      'node_modules/manifold-3d/manifold.wasm',
      'dist/vendors/manifold.wasm',
    )
  },
}

// Inject <script type="importmap"> into every HTML page so that dynamically
// loaded example files can resolve bare specifiers ('three', 'tone') to the
// hashed chunk URLs that Vite emits.  Without this the browser rejects bare
// specifiers in raw static JS files that are not processed by Vite's bundler.
const importMapPlugin = {
  name: 'inject-import-map',
  transformIndexHtml: {
    order: 'post',
    handler(html, ctx) {
      const base = process.env.BASE_URL ?? '/'
      const imports = {
        'three':         `${base}vendors/three.esm.js`,
        'tone':          `${base}vendors/tone.esm.js`,
        'manifold-3d':   `${base}vendors/manifold.esm.js`,
        '@dimforge/rapier3d-compat': `${base}vendors/rapier.mjs`,
        // Prefix mapping: three/addons/X → vendors/three-addons/X
        'three/addons/': `${base}vendors/three-addons/`,
      }
      if (!ctx.bundle) {
        imports.three = `${base}node_modules/three/build/three.module.js`
        imports.tone = `${base}node_modules/tone/build/esm/index.js`
        imports['manifold-3d'] = `${base}node_modules/manifold-3d/manifold.js`
        imports['@dimforge/rapier3d-compat'] = `${base}node_modules/@dimforge/rapier3d-compat/rapier.mjs`
        imports['three/addons/'] = `${base}node_modules/three/examples/jsm/`
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

  plugins: [assetCatalogPlugin, copyExamplesPlugin, importMapPlugin],

  build: {
    target: 'esnext',
    rollupOptions: {
      input: {
        main: 'index.html',
      },
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/monaco-editor/')) return 'monaco'
          if (id.includes('/node_modules/three/')) return 'three'
          if (id.includes('/node_modules/tone/')) return 'tone'
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
  optimizeDeps: { exclude: ['three', 'manifold-3d', '@rollup/browser'] },
})
