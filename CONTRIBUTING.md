# Contributing to Artlab

---

## Quick start

```bash
git clone <repo-url> artlab
cd artlab
npm install
npm run dev
```

Open http://localhost:5173. The dev server hot-reloads on every save.

---

## Project structure

```
src/
  stdlib/       Public API consumed by examples and packages
  physics/      Rapier3D wrappers (RigidWorld, OrbitalWorld, ParticleWorld, FluidWorld)
  runtime/      StandaloneRunner — full-screen package execution
  ide/          IDE shell, Monaco integration, panel components, PreviewPane
  audio/        Tone.js engine, FFT pipeline, synth pads
  assets/       Texture, audio, and model loaders
examples/       Reference packages ordered basic → intermediate → advanced
docs/           Static HTML documentation (index, stdlib, tutorial)
bin/            artlab CLI entry point
```

### Key files

| Path | Purpose |
|---|---|
| `src/ide/PreviewPane.js` | Sandboxed live preview inside the IDE (constructs the `ctx` object used by every example) |
| `src/runtime/StandaloneRunner.js` | Full-screen runtime for exported / standalone packages |
| `src/stdlib/geometry.js` | Geometry factories and `mesh()` helper |
| `src/stdlib/lights.js` | Light factories |
| `src/stdlib/math.js` | `lerp`, `clamp`, `map`, `smoothstep`, `rad`, `deg`, Perlin `noise2` / `noise3` |
| `src/stdlib/audio.js` | Mic input, FFT bands, Tone.js synth helpers |
| `src/stdlib/video.js` | Webcam, screen capture, video textures, shader effects |

---

## Writing an example

Examples are the primary way to demonstrate Artlab concepts. Every example is a
self-contained directory under `examples/`.

### Anatomy

```
examples/my-example/
  artlab.json        Manifest (required)
  my-example.js      Entry module (required)
  my-example.test.js Vitest test (required; named to match the entry)
  assets/            Textures, audio, data files (optional)
  tutorial.json      Optional guided code-tour consumed by the IDE tutorial pane
```

### The manifest — `artlab.json`

```json
{
  "name": "my-example",
  "version": "1.0.0",
  "entry": "my-example.js",
  "description": "One sentence, present tense, no period",
  "category": "geometry",
  "tags": ["lights", "animation"],
  "author": "Your Name"
}
```

Required fields: `name`, `version`, `entry`, `description`.
Optional fields: `category`, `tags`, `author`.

`name` must match the directory name. `entry` is the JS file relative to the
package directory.

### The lifecycle contract

The entry file exports up to three named functions:

```js
// Called once when the package loads. May be async.
export async function setup(ctx) { ... }

// Called every frame. dt is seconds since last frame.
export function update(ctx, dt) { ... }

// Called when the package is unloaded or the IDE reloads.
// Must remove any event listeners added in setup.
export function teardown(ctx) { ... }
```

All three are optional, but most packages need at least `setup` and `update`.
`teardown` is required whenever `setup` attaches event listeners.

### The ctx object

Both `StandaloneRunner` and `PreviewPane` inject the same context shape:

| Field | Type | Description |
|---|---|---|
| `THREE` | namespace | The full `three` module — use for constants, constructors, etc. |
| `scene` | `THREE.Scene` | The live scene; prefer `ctx.add()` over `scene.add()` directly |
| `camera` | `THREE.PerspectiveCamera` | Set position/rotation in setup |
| `renderer` | `THREE.WebGLRenderer` | Direct renderer access for advanced config |
| `controls` | `OrbitControls` | Orbit controls — configure target, distances, etc. |
| `labelRenderer` | `CSS2DRenderer` | CSS2D label overlay (StandaloneRunner only) |
| `add(obj)` | function | Add an object to the scene; returns the object |
| `remove(obj)` | function | Remove an object from the scene |
| `setBloom(strength)` | function | Set bloom post-processing strength (0–3, 0 disables) |
| `setHelp(text)` | function | One-line interaction hint shown above the preview; clears automatically on reload |
| `elapsed` | number | Seconds since setup completed (read-only, updated each frame) |

The PreviewPane ctx also exposes the stdlib helpers as top-level fields
(`sphere`, `box`, `mesh`, `ambient`, `point`, `lerp`, `smoothstep`, `vec3`,
`color`, etc.) so IDE examples can use them without imports. Standalone /
exported packages use explicit imports instead.

### Interaction hints — `setHelp(text)`

If your example listens for mouse or keyboard events, declare it in `setup()`:

```js
export function setup(ctx) {
  ctx.setHelp('Click to spawn a body   •   Space to reset')
  // ...
}
```

The string renders in the preview toolbar next to "Preview". Keep it to one
line; use `•` to separate controls. Skip it for examples whose only interaction
is a one-time gesture button (e.g. "Enable Microphone") — the button is
self-labeling.

### The stdlib-only rule

Examples must not import from `src/` directly. Use `three` and imports relative
to the package directory only.

```js
// Correct — import from three or from a relative stdlib path
import * as THREE from 'three'
import { sphere, mesh } from '../../src/stdlib/geometry.js'

// Wrong — never reach into src/ for non-stdlib modules
import { StandaloneRunner } from '../../src/runtime/StandaloneRunner.js'
```

The stdlib path `../../src/stdlib/...` is the current convention until a
package alias (`artlab/stdlib`) is wired into the Vite config.

### Asset handling

Use `new URL()` with `import.meta.url` so Vite and the IDE can both resolve
package-relative assets correctly:

```js
const texUrl = new URL('./assets/rock.jpg', import.meta.url).href
const tex = new THREE.TextureLoader().load(texUrl)
```

Never use absolute `/public/` paths — they break when the package runs inside
the IDE sandbox.

### Scale conventions

Pick a scale that suits the subject and stay consistent within the package. A
few reference conventions used across the examples:

| Domain | Convention | Examples |
|---|---|---|
| Abstract / desktop-scale | 1 unit ≈ 1 m; camera 5–15 units out | `hello-cube`, `wave-sculpture`, `color-fields` |
| Orbital / space | 1 AU = 100 units; Earth radius = 2.5 units; 1 year = 120 s | `solar-system`, `orbital-dance` |
| 3D-printable / CSG | 1 unit = 1 mm; camera positioned accordingly | `printable-bracket` |

### 3D printing and CSG

Printable sketches should produce a **manifold** (watertight, outward-normal)
mesh so the exported STL/OBJ slices cleanly. Use
[`manifold-3d`](https://github.com/elalish/manifold) for boolean operations
(union, difference, intersection) — its output is manifold by construction.
See `examples/printable-bracket` for the full pattern: build a `Manifold`,
convert `man.getMesh()` → `THREE.BufferGeometry`, display it for preview, and
expose STL / OBJ export via `three/addons/exporters/`.

Use mm as the unit (1 artlab unit = 1 mm) so bounding boxes map directly to
slicer input.

### Example tiers

| Tier | Lines | Concepts | Examples |
|---|---|---|---|
| Basic | < 100 | Single concept | `hello-cube`, `aurora` |
| Intermediate | 100–300 | 2–3 concepts composed | `wave-sculpture`, `color-fields`, `domino-chain` |
| Advanced | 300+ | Full composition across multiple stdlib modules | `solar-system`, `music-synth`, `marble-run` |

Start at the basic tier unless the task explicitly requires more.

---

## Writing a stdlib module

### File location

`src/stdlib/<module>.js`

### Style rules

- Export plain functions, not classes. A class is acceptable only when it
  carries genuinely mutable state that plain functions cannot model cleanly
  (e.g., a stateful animation system). If in doubt, use functions.
- One-line JSDoc comment on every exported function — no `@param`/`@returns`
  blocks unless the signature is genuinely ambiguous.
- No side effects at import time. The module must be safe to `import` without
  a DOM, a canvas, or a running renderer.
- Must work identically in `StandaloneRunner` context and `PreviewPane` context.

### Template

```js
/**
 * artlab/<module> — short description
 */

import * as THREE from 'three'

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

/** One-line description of what this function does. */
export function doSomething(arg) {
  // ...
}
```

---

## Testing

Test runner: **Vitest**

```bash
npm test          # run all tests once
npm run test:watch  # watch mode
```

### Example tests

Every example needs a test at `examples/<name>/<name>.test.js` (filename
matches the entry module). Use a minimal mock ctx so tests run without a DOM
or WebGL context:

```js
import { describe, it, expect, vi } from 'vitest'
import { setup, update, teardown } from './my-example.js'

const mockTHREE = {
  Color: class { constructor(v) { this.v = v } },
  // Add only what your example actually uses
}

function makeCtx(overrides = {}) {
  return {
    THREE: mockTHREE,
    scene: { add: vi.fn(), remove: vi.fn() },
    camera: { position: { set: vi.fn() } },
    renderer: { shadowMap: {} },
    controls: { target: { set: vi.fn() } },
    add: vi.fn(),
    remove: vi.fn(),
    setBloom: vi.fn(),
    setHelp:  vi.fn(),
    elapsed: 0,
    ...overrides,
  }
}

describe('my-example', () => {
  it('setup runs without throwing', async () => {
    const ctx = makeCtx()
    await setup(ctx)
    expect(ctx.add).toHaveBeenCalled()
  })

  it('update runs without throwing', async () => {
    const ctx = makeCtx()
    await setup(ctx)
    expect(() => update(ctx, 0.016)).not.toThrow()
  })

  it('teardown removes added objects', async () => {
    const ctx = makeCtx()
    await setup(ctx)
    teardown(ctx)
    expect(ctx.remove).toHaveBeenCalled()
  })
})
```

### Stdlib tests

`src/stdlib/__tests__/<module>.test.js`

Stdlib functions are pure utilities and do not need a mock ctx. Import and
exercise them directly.

---

## Issue tracking

This project uses **bd** (beads) for all issue tracking. Do not create markdown
TODO lists or use external trackers.

```bash
bd ready                          # find unblocked work
bd show <id>                      # read an issue
bd update <id> --claim            # claim before starting
bd close <id> --reason "Done"     # close when finished
```

Rules:
- Claim an issue before you start work on it.
- If you discover new work while implementing, create a linked issue:
  `bd create "title" --description="..." --deps discovered-from:<parent-id>`
- Close the issue and push before ending a session. Work is not complete until
  `git push` succeeds.

---

## Code style

- ES6 modules throughout. No TypeScript, no JSX.
- Inline comments only when the **why** is non-obvious. Do not comment what the
  code already says.
- No docstrings beyond the one-line JSDoc on exported functions.
- Prefer small focused functions over classes.
- No feature flags, no backwards-compatibility shims. Change the code.
- `const` by default; `let` when reassignment is necessary; never `var`.

---

## PR checklist

Before opening a pull request, verify each item:

- [ ] Example has a valid `artlab.json` with all required fields
- [ ] Test file exists at `examples/<name>/<name>.test.js` and passes (`npm test`)
- [ ] Example is registered in the `EXAMPLES` array in `src/ide/IDE.js`
- [ ] No direct `src/` imports beyond stdlib and physics (paths `../../src/stdlib/` and `../../src/physics/` are allowed; runtime or IDE internals are off-limits)
- [ ] All assets are loaded with the `new URL('./assets/...', import.meta.url).href` pattern
- [ ] `teardown` removes any event listeners, DOM overlays, and media streams opened during `setup` (run the example, switch to another, and confirm no leftover buttons or indicators)
- [ ] If the example responds to mouse or keyboard input, it calls `ctx.setHelp(...)` in `setup`
