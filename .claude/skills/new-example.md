---
name: new-example
description: Create a new Artlab example package
---

Create a new Artlab example package by following these steps in order.

## Step 1 — Create the directory

```bash
mkdir -p examples/<name>
```

The directory name becomes the package name. Use kebab-case.

## Step 2 — Write `artlab.json`

Create `examples/<name>/artlab.json` using this template exactly:

```json
{
  "name": "<name>",
  "version": "1.0.0",
  "entry": "<name>.js",
  "description": "<one sentence, present tense, no trailing period>"
}
```

Optional fields you may add: `"category"`, `"tags"` (array), `"author"`.

The `name` field must match the directory name. The `entry` field must be a
filename relative to the package directory.

## Step 3 — Write the entry JS file

Create `examples/<name>/<name>.js`. The module must export named functions
that satisfy the Artlab lifecycle contract:

```js
// <name>.js — <one-line description>
import * as THREE from 'three'

// Module-level variables for objects that teardown needs to reach
let myMesh

export async function setup(ctx) {
  // Position camera
  ctx.camera.position.set(0, 2, 8)

  // Add lights
  ctx.add(new THREE.AmbientLight(0x222233, 1.0))

  // Build geometry and add to scene
  const geo = new THREE.BoxGeometry(1, 1, 1)
  const mat = new THREE.MeshStandardMaterial({ color: 0x3344cc })
  myMesh = new THREE.Mesh(geo, mat)
  ctx.add(myMesh)
}

export function update(ctx, dt) {
  myMesh.rotation.y += dt
}

export function teardown(ctx) {
  ctx.remove(myMesh)
  // Remove any window/document event listeners added in setup here
}
```

Rules for the entry file:
- `setup` may be `async` — use it freely for texture loads, audio init, etc.
- `update(ctx, dt)` receives elapsed seconds since last frame as `dt`.
  Use `ctx.elapsed` for total time since setup.
- `teardown` must call `ctx.remove()` for every object added with `ctx.add()`,
  and must remove any event listeners added during `setup`.
- Do not import from `src/runtime/`, `src/ide/`, or any non-stdlib `src/` path.
  Allowed imports: `three`, and `../../src/stdlib/<module>.js`.
- Load assets with `new URL('./assets/<file>', import.meta.url).href` — never
  with absolute `/public/` paths.

### Asset pattern

```js
const texUrl = new URL('./assets/rock.jpg', import.meta.url).href
const tex = new THREE.TextureLoader().load(texUrl)
```

### Scale conventions for orbital / space demos

| Concept | Value |
|---|---|
| 1 AU | 100 units |
| Earth radius | 2.5 units |
| 1 simulation year | 120 real seconds |

## Step 4 — Write the test file

Create `examples/<name>/example.test.js`:

```js
import { describe, it, expect, vi } from 'vitest'
import { setup, update, teardown } from './<name>.js'

// Build only the THREE stubs your example actually calls.
// Extend mockTHREE as needed — do not stub the entire library.
const mockTHREE = {
  Color: class { constructor(v) { this.v = v } },
  AmbientLight: class { constructor() {} },
  BoxGeometry: class { constructor() {} },
  MeshStandardMaterial: class { constructor(o) { Object.assign(this, o) } },
  Mesh: class {
    constructor(g, m) { this.geometry = g; this.material = m }
    rotation = { x: 0, y: 0, z: 0 }
    position = { set: vi.fn() }
  },
}

function makeCtx(overrides = {}) {
  return {
    THREE: mockTHREE,
    scene: { add: vi.fn(), remove: vi.fn() },
    camera: { position: { set: vi.fn() }, lookAt: vi.fn() },
    renderer: { shadowMap: {} },
    controls: { target: { set: vi.fn() } },
    add: vi.fn(),
    remove: vi.fn(),
    setBloom: vi.fn(),
    elapsed: 0,
    ...overrides,
  }
}

describe('<name>', () => {
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

  it('teardown removes all added objects', async () => {
    const ctx = makeCtx()
    await setup(ctx)
    teardown(ctx)
    expect(ctx.remove).toHaveBeenCalled()
  })
})
```

Run tests with `npm test` to confirm they pass before committing.

## Step 5 — Verify

Before committing, check every item:

- No `src/runtime/`, `src/ide/`, or other non-stdlib `src/` imports in the
  entry JS file.
- `teardown` calls `ctx.remove()` for every object added with `ctx.add()`.
- `teardown` removes any event listeners registered in `setup`.
- Assets (if any) use `new URL('./assets/...', import.meta.url).href`.
- `artlab.json` has all four required fields (`name`, `version`, `entry`,
  `description`) and the `name` matches the directory.
- `npm test` passes.

## Step 6 — Register with bd (if applicable)

If you are working from a `bd` issue, close it when done:

```bash
bd close <id> --reason "Added <name> example"
```

If you discovered a follow-up task while implementing, create a linked issue:

```bash
bd create "Follow-up title" --description="Details" -p 2 \
  --deps discovered-from:<parent-id> --json
```

Then push:

```bash
git add examples/<name>/
git commit -m "examples: add <name>"
git push
```
