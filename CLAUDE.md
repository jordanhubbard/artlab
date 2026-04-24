# Artlab — Claude working notes

Guidelines distilled from past debugging sessions. Apply these proactively when
writing or reviewing examples and framework code.

---

## Audio examples

### 1. Gate all audio init behind a user-gesture button

`new AudioContext()`, `Tone.start()`, and `getUserMedia()` must be called from
a click handler, never from `setup()` directly. Chrome suspends any AudioContext
created without a preceding user gesture, producing silence with no error.

Pattern (from `music-synth.js` and `music-visualizer.js`):

```js
export function setup(ctx) {
  const btn = document.createElement('button')
  // … apply standard artlab button CSS …
  btn.textContent = 'Start'
  ctx.renderer.domElement.parentElement.appendChild(btn)

  btn.addEventListener('click', async () => {
    btn.style.display = 'none'
    await Tone.start()          // or new AudioContext() for raw Web Audio
    // … build synths, open mic, start sequencers …
  }, { once: true })

  ctx._startBtn = btn           // store so teardown() can remove it
}

export function teardown(ctx) {
  ctx._startBtn?.remove()
  // … rest of teardown …
}
```

### 2. Connect the terminal audio effect to the destination

`reverb()` and `delay()` in `src/stdlib/audio.js` return unwired Tone.js nodes.
Calling `.connect(_rev)` routes audio *into* the reverb, but the reverb itself
has no downstream connection until you add:

```js
_rev = reverb({ decay: 4, wet: 0.55 })
_rev.toDestination()            // ← required or all audio is silently dropped
```

Only synths that call `.toDestination()` directly (e.g. `_bassSynth`) are
exempt. Every other voice that routes through an effect chain must have
`.toDestination()` on the terminal node.

### 3. Always call `ctx.setHelp()`

Every example must call `ctx.setHelp('...')` as the first line of `setup()`.
Describe what the example does and list any controls (keyboard keys, button
clicks, mic requirement, etc.). Without this the canvas toolbar is blank and
users have no idea how to interact with the example.

```js
export function setup(ctx) {
  ctx.setHelp('Space: start / stop   •   requires microphone')
  // …
}
```

---

## Production build (vite.config.js)

### 4. Checklist for every new bare-specifier import in an example

When an example uses `import X from 'pkg'` or `import { Y } from 'three/addons/...'`,
three things must be present in `vite.config.js` or the example fails silently
in production (GitHub Pages) with a blank canvas and no visible error:

| Step | Where | What |
|------|-------|------|
| 1 | `copyExamplesPlugin.closeBundle()` | Copy or esbuild-bundle the package into `dist/vendors/` |
| 2 | `importMapPlugin` `imports` object | Map the bare specifier → vendor URL |
| 3 | WASM packages only | Copy the `.wasm` binary to `dist/vendors/` alongside the JS bundle |

**Currently mapped specifiers:** `three`, `tone`, `manifold-3d`, `three/addons/*`

**Currently copied three/addons files:**
- `renderers/CSS2DRenderer.js`
- `exporters/STLExporter.js`
- `exporters/OBJExporter.js`

Add a new entry here whenever an example adds a new `three/addons/` import.

#### WASM packages (e.g. manifold-3d)

The Emscripten runtime resolves the `.wasm` binary relative to `import.meta.url`
of the JS bundle. Both files must live in the same directory:

```js
// In copyExamplesPlugin:
await esbuild({
  entryPoints: ['node_modules/manifold-3d/manifold.js'],
  bundle: true, format: 'esm', minify: true,
  outfile: 'dist/vendors/manifold.esm.js',
})
copyFileSync('node_modules/manifold-3d/manifold.wasm', 'dist/vendors/manifold.wasm')

// In importMapPlugin:
'manifold-3d': `${base}vendors/manifold.esm.js`,
```
