# Artlab

A browser-based creative coding IDE for building interactive 3D art, animations, and generative visuals in JavaScript.

## Quick start

```bash
git clone <repo-url> artlab
cd artlab
npm install
npm run dev
```

Open http://localhost:5173. The IDE loads immediately with all examples available in the sidebar.

## What it is

Artlab is an in-browser IDE backed by a WebGL/WebGPU runtime. You write a small JavaScript module that exports `setup`, `update`, and `teardown` functions; the runtime calls them and provides a Three.js scene, camera, controls, and a stdlib of helpers for geometry, lights, physics, audio, video, and more.

The editor (Monaco) runs on the left, a live preview canvas on the right. Changes run on demand via **Run** (Ctrl+Enter). Packages can be opened from disk as a folder or `.zip`, edited, and exported back out.

## Examples

31 reference packages live in `examples/`, from a five-part tutorial series to advanced demos:

| Category | Examples |
|---|---|
| Tutorials | `tutorial-01-geometry` → `tutorial-05-interaction` |
| Basic | `hello-cube`, `aurora`, `color-fields`, `canvas-2d` |
| Intermediate | `wave-sculpture`, `particle-storm`, `orbital-dance`, `audio-pulse`, `typography-art` |
| Advanced | `solar-system`, `physics-particles`, `music-synth`, `video-fx`, `video-kaleidoscope` |
| New | `clock-kinetic`, `flocking-boids`, `terrain-flyover`, `strange-attractor`, `fractal-tree`, `domino-chain`, `audio-terrain`, `reaction-diffusion`, `shader-playground` |

Click **Examples** in the toolbar or select any entry in the sidebar to load one.

## Package lifecycle

Every package is a directory with an `artlab.json` manifest and a JS entry file that exports:

```js
export async function setup(ctx) { /* build the scene once */ }
export function update(ctx, dt)  { /* called every frame, dt in seconds */ }
export function teardown(ctx)    { /* remove listeners, clean up */ }
```

The `ctx` object provides `THREE`, `scene`, `camera`, `renderer`, `controls`, `add()`, `remove()`, `setBloom()`, and `elapsed`. The stdlib (`src/stdlib/`) adds geometry factories, light helpers, math utilities, physics, audio, and video.

## Documentation

| | |
|---|---|
| [Runtime API](docs/stdlib.html) | stdlib module reference |
| [Tutorial](docs/tutorial.html) | build a scene step by step |
| [Contributing](CONTRIBUTING.md) | project structure, writing examples, code style |

## Project structure

```
src/
  stdlib/     Public API for examples — geometry, lights, math, audio, physics, video, ui
  physics/    Rapier3D wrappers (RigidWorld, OrbitalWorld, ParticleWorld, FluidWorld)
  runtime/    StandaloneRunner and animation loop
  ide/        Monaco integration, panel layout, preview sandbox
  audio/      Tone.js engine, FFT pipeline, synth pads
  assets/     Texture, audio, and model loaders
examples/     Reference packages (see above)
docs/         Static HTML docs — stdlib reference, tutorial
bin/          artlab CLI
```

## Build

```bash
npm run build    # output to dist/
npm run preview  # serve the production build locally
```

## Testing

```bash
npm test              # run all tests once
npm run test:watch
```

Every example has a `<name>.test.js` that exercises `setup`/`update`/`teardown` against a lightweight mock ctx. Stdlib modules have unit tests under `src/stdlib/__tests__/`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide: writing examples, stdlib conventions, test patterns, and the PR checklist.
