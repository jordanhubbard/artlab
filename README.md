# Artlab

A browser-based creative-coding IDE for building interactive 3D scenes, generative visuals, audio-reactive art, and 3D-printable geometry in JavaScript.

## Quick start

```bash
git clone <repo-url> artlab
cd artlab
npm install
npm run dev
```

Open http://localhost:5173. The IDE opens with an empty preview — pick any entry from the Examples section of the sidebar to load it.

## What it is

Artlab is an in-browser IDE backed by a Three.js / WebGL runtime. You write a small JavaScript module that exports `setup`, `update`, and `teardown`; the runtime calls them and injects a `ctx` object with the scene, camera, renderer, OrbitControls, and a stdlib of helpers for geometry, lights, math, physics, audio, video, and UI.

The editor (Monaco) lives on the left, a live preview on the right. Re-run with Ctrl+Enter. Packages are directories with an `artlab.json` manifest; they can be opened from disk, edited, and exported as `.zip`.

Artlab is **synthesis-first**: every reference example generates geometry, textures, audio, and motion procedurally. Asset loading exists (GLTF, OBJ, textures, audio clips) but the built-in examples don't lean on it.

## Examples

About 50 reference packages live in `examples/`. Pick one from the sidebar or click **Examples** in the toolbar.

| Category | Examples |
|---|---|
| Tutorials | `tutorial-01-geometry` → `tutorial-05-interaction` |
| Primitives & fractals | `hello-cube`, `mobius-strip`, `penrose-tiles`, `fractal-tree`, `recursive-spirals` |
| Lighting & color | `aurora`, `color-fields`, `neon-city`, `shader-gallery`, `shader-playground` |
| Procedural & generative | `terrain-flyover`, `wave-sculpture`, `flow-field`, `reaction-diffusion`, `fluid-2d`, `strange-attractor`, `canvas-2d` |
| Physics | `domino-chain`, `marble-run`, `n-body-gravity`, `physics-particles`, `force-field-playground`, `flocking-boids`, `cloth-sim`, `voronoi-shatter` |
| Audio | `audio-pulse`, `audio-terrain`, `music-synth`, `music-visualizer`, `synth-keyboard` |
| Video | `chroma-mirror`, `video-fx`, `video-kaleidoscope`, `video-broadcast` |
| Data & UI | `data-sculpture`, `ui-showcase`, `typography-art`, `clock-3d`, `clock-kinetic` |
| Camera & motion | `camera-journey`, `orbital-dance`, `solar-system`, `particle-storm`, `pixel-sort` |
| 3D printing & CSG | `printable-bracket` — parametric solid built with `manifold-3d`, exports STL / OBJ |

## The `ctx` object

Every example receives `ctx` in `setup`, `update`, and `teardown`:

| Field | Purpose |
|---|---|
| `Three` | the full `three` module |
| `scene`, `camera`, `renderer`, `controls` | Three.js objects, pre-wired |
| `labelRenderer` | CSS2DRenderer for 3D-tracked DOM labels |
| `add(obj)` / `remove(obj)` | add / remove scene objects (auto-cleaned between runs) |
| `elapsed` | seconds since setup (updated each frame) |
| `setBloom(strength)` | bloom post-processing strength; 0 disables, 0.3–2.0 typical |
| `setHelp(text)` | one-line interaction hint shown above the preview pane |
| `vec2 / vec3 / vec4 / color / quat` | shorthand constructors |
| `sphere / box / cylinder / cone / torus / plane / ring / mesh` | geometry factories |
| `ambient / point / directional / spot / hemisphere` | light factories |
| `lerp / clamp / map / smoothstep / rad / deg / range` | math helpers |
| `loadTexture(path)` | texture loader that resolves package-relative paths |

### `setHelp(text)`

If your example responds to mouse or keyboard input, call `ctx.setHelp(...)` in `setup()` with a concise control summary. It renders next to "Preview" in the toolbar and clears automatically when the next example loads.

```js
export function setup(ctx) {
  ctx.setHelp('Click to spawn a body   •   Space to reset')
  // ...
}
```

### 3D printing / CSG synthesis

`examples/printable-bracket` shows how to build a manifold solid with [`manifold-3d`](https://github.com/elalish/manifold) (WASM-backed CSG with guaranteed manifold output) and export it as STL or OBJ via Three.js's built-in exporters. The convention for printable sketches is **1 artlab unit = 1 mm**.

## Package lifecycle

Every package is a directory with an `artlab.json` manifest and a JS entry:

```js
export async function setup(ctx) { /* build the scene once */ }
export function update(ctx, dt)  { /* called every frame, dt in seconds */ }
export function teardown(ctx)    { /* remove listeners, dispose resources */ }
```

`setup` may be async. `teardown` is required if `setup` attaches window-level listeners, opens a webcam, or starts audio.

## Documentation

| | |
|---|---|
| [Runtime API](docs/stdlib.html) | stdlib module reference (math, geometry, lights, audio, video, physics, ui) |
| [Tutorial](docs/tutorial.html) | build a scene step by step |
| [Contributing](CONTRIBUTING.md) | project structure, writing examples, code style, PR checklist |

## Project structure

```
src/
  stdlib/     Public API for examples — geometry, lights, math, audio, physics, video, ui
  physics/    Rapier3D wrappers (RigidWorld, OrbitalWorld, ParticleWorld, FluidWorld)
  audio/      Tone.js engine, FFT pipeline, synth pads
  runtime/    StandaloneRunner — full-screen runtime for exported packages
  ide/        Monaco integration, panel layout, PreviewPane sandbox
  assets/     Texture, audio, and model loaders
examples/     Reference packages (see above)
docs/         Static HTML docs — stdlib reference, tutorial
bin/          `artlab` CLI (create / serve / build / pack packages)
```

## Build & test

```bash
npm run build          # build to dist/
npm run preview        # serve the production build locally
npm test               # run vitest once
npm run test:watch     # watch mode
npm run test:e2e       # Playwright end-to-end (builds first)
```

Every example has a `<name>.test.js` that exercises `setup`/`update`/`teardown` against a lightweight mock ctx. Stdlib modules have unit tests under `src/stdlib/__tests__/`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide: writing examples, stdlib conventions, test patterns, and the PR checklist.
