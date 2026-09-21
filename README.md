# Artlab

A browser-based creative-coding IDE for building interactive 3D scenes, generative visuals, audio-reactive art, and 3D-printable geometry in JavaScript or TypeScript.

**Live app:** [https://jordanhubbard.github.io/artlab/](https://jordanhubbard.github.io/artlab/)

## Quick start

```bash
git clone https://github.com/jordanhubbard/artlab.git
cd artlab
npm install
npm run dev
```

Open http://localhost:5173, or use the [published GitHub Pages build](https://jordanhubbard.github.io/artlab/). The IDE opens with an empty preview — pick any entry from the Examples section of the sidebar to load it.

## What it is

Artlab is an in-browser IDE backed by a Three.js / WebGL runtime. You write a small JavaScript or TypeScript module that exports `setup`, `update`, and `teardown`; the runtime calls them and injects a `ctx` object with the scene, camera, renderer, OrbitControls, and a stdlib of helpers for geometry, lights, math, physics, audio, video, and UI.

The editor (Monaco) lives on the left, a live preview on the right. Re-run with Ctrl+Enter. Packages are directories with an `artlab.json` manifest; they can be opened from disk, edited, and exported as `.zip`.

Artlab is **synthesis-first**: every reference example generates geometry, textures, audio, and motion procedurally. Asset loading exists (GLTF, OBJ, textures, audio clips) but the built-in examples don't lean on it.

## Explore the implementation

Choosing an example opens its entry and helper modules. **Environment source** in the
sidebar lets you browse and edit Artlab's shared classes. **Run** rebuilds the complete
JS/TS module graph, so changes in a helper or library class affect the scene immediately.
Export keeps your source and its shared dependencies together.

New compositions can extend `Scene` and combine `ParticleField`, `InstanceField`,
`Trail`, `ShaderSurface`, and other independently owned components. See the
[scene architecture guide](docs/scene-architecture.md) for the API, ownership rules,
and refactoring audit, and [Long Winter](docs/demoscene-direction.md) for the proposed
Amiga-inspired production direction.

## Examples

About 50 reference packages live in `examples/`. Open them in the [live IDE](https://jordanhubbard.github.io/artlab/), or pick one from the local sidebar / **Examples** toolbar.

Recent gallery pieces:

| Example | What it is |
|---|---|
| `signal-salvage` | **Signal Salvage** — a chaotic score attack with changing harmonic scenes, four collectible species, random anomalies, a camera-textured signal veil, and microphone-reactive effects |
| `long-winter` | **Long Winter: Second Mix** — nine original songs move through fjord, cabin, pine, birch, snow, and aurora scenes before an Amiga-inspired color storm |
| `typography-art` | **Monument** — the word LANGUAGE as walkable brutalist architecture under a raking dawn sun |
| `color-fields` | **Chromatic Weather** — one pigment sheet that swells, dissolves into haze, and stirs under the pointer |
| `orbital-dance` | **Luminous Choreography** — five occluding bodies, ribbon trails, and intersecting orbital planes |
| `pixel-sort` | **Memory Corruption** — a dusk landscape whose memory fails in traveling sorted bands |
| `fractal-tree` | **Old Growth** — ground-level view under a finished canopy, roots, fog, and wind |
| `tide-eroded-vessel` | Printable vase grown by CSG erosion, barnacle crust, and tide-pool windows |
| `bell-orrery` | Five spatialized singing-bowl rings orbiting a dark obelisk |
| `motion-scale-lantern` | Webcam mapped onto hinged icosahedron scales that flare open with motion |

Full catalog:

| Category | Examples |
|---|---|
| Tutorials | `tutorial-01-geometry` → `tutorial-05-interaction` |
| Primitives & fractals | `hello-cube`, `mobius-strip`, `penrose-tiles`, `fractal-tree`, `recursive-spirals` |
| Lighting & color | `aurora`, `color-fields`, `neon-city`, `shader-gallery`, `shader-playground` |
| Procedural & generative | `terrain-flyover`, `wave-sculpture`, `flow-field`, `reaction-diffusion`, `fluid-2d`, `strange-attractor`, `canvas-2d` |
| Physics | `domino-chain`, `marble-run`, `n-body-gravity`, `physics-particles`, `force-field-playground`, `flocking-boids`, `cloth-sim`, `voronoi-shatter` |
| Audio | `audio-pulse`, `audio-terrain`, `music-synth`, `music-visualizer`, `synth-keyboard`, `bell-orrery` |
| Video | `chroma-mirror`, `video-fx`, `video-kaleidoscope`, `video-broadcast`, `motion-scale-lantern` |
| Data & UI | `data-sculpture`, `ui-showcase`, `typography-art`, `clock-3d`, `clock-kinetic` |
| Camera & motion | `camera-journey`, `orbital-dance`, `solar-system`, `particle-storm`, `pixel-sort`, `long-winter` |
| Games & multimodal | `signal-salvage` — keyboard flight through camera-textured worlds with microphone-reactive effects, evolving music, typed collectibles, and random hazards |
| 3D printing & CSG | `printable-bracket`, `tide-eroded-vessel` — parametric solids with `manifold-3d`, export STL / OBJ |

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

<!-- ai-template:narrative:start -->
## The Totally True and Not At All Embellished History of Artlab

### The continuing adventures of Jordan Hubbard and Sir Reginald von Fluffington III

> *Part 14 of an ongoing chronicle. [← Part 13: agentOS](https://github.com/jordanhubbard/agentos#the-totally-true-and-not-at-all-embellished-history-of-agentos) | [Part 15: Crust →](https://github.com/jordanhubbard/crust#the-totally-true-and-not-at-all-embellished-history-of-crust)*
> *[Chronicle index](https://github.com/jordanhubbard/ai-template/blob/main/CHRONICLE.md) · Ordered by first recorded AI-assisted commit.*

The programmer wanted to make a picture.

Sir Reginald von Fluffington III, who regularly made pictures by arranging himself in the center of whatever the programmer was attempting to photograph, considered this a manageable ambition.

“I will need an editor,” the programmer said. “And a live preview. Geometry helpers. Shaders. Audio. Possibly physics.”

Sir Reginald reassessed the scope.

Artlab became a browser-based workshop with Monaco on one side and a Three.js scene on the other. A small JavaScript module supplied `setup`, `update`, and `teardown`. The runtime supplied `ctx`: scene, camera, renderer, controls, and the means to turn an idea into something visible without first building a different application to hold it.

The examples were to synthesize their materials. Geometry, textures, movement, and sound would emerge procedurally. A tree could grow from rules. Pigment could move like weather. A word could become architecture. Sir Reginald examined this last development with concern; words already occupied too much of the room.

Audio introduced a familiar obstacle. The browser expected a user gesture before it would make noise. The programmer clicked. The cat, who had expected this gesture to open dinner, filed the result under false advertising.

Then the pictures acquired volume. Constructive solid geometry could produce objects for export as STL or OBJ, and suddenly a vase grown by subtraction was a thing that might leave the screen. The programmer regarded this as a natural extension of creative coding. Sir Reginald regarded it as an increase in the inventory of objects available to knock down.

The packages could be edited, opened from disk, and exported as zip files. Ctrl+Enter would run the current work again. An experiment could remain an experiment without requiring a separate repository and a launch ceremony.

“It is just a place to try things,” the programmer said.

Sir Reginald walked across the keyboard. The next run was more abstract. Neither party accepted responsibility, and the cat withheld endorsement on the grounds that the preview still could not be slept in.

<!-- ai-template:narrative:end -->
