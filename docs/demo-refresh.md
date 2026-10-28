# Gallery and runtime refresh

The gallery keeps 55 active lessons: two new subjects replace two redundant
entries. Compatibility packages and hash aliases preserve old links. Small
foundational lessons remain intentionally small; the five numbered tutorials
should not become performance showcases.

## Curation decisions

Similarity of appearance is not enough to delete a lesson. Keep a demo when its
algorithm, input/output contract, or position in the learning progression is
meaningfully different. Consolidate when the difference is mostly styling.

| Packages | Decision and educational purpose |
|---|---|
| `clock-3d`, `clock-kinetic` | Consolidated into Chronometer (`clock-3d`). One time calculation drives pivoted analog hands and rotating marker rings. Style slider compares representations. Old package delegates to the canonical implementation. |
| `physics-particles`, `particle-storm` | Consolidated into Ember Engine (`physics-particles`). One fixed-step body pool compares gravity/drag with a vortex storm. Its reusable EmberField class remains browsable in the source library; the gallery no longer needs a separate particle-motion entry. |
| `interference-atlas` | New: complex-amplitude superposition and squared magnitude. Phase, wavelength, and source separation reveal cancellation and nodal curves. Neither the wave geometry lesson nor shader gallery teaches this relationship. |
| `volume-observatory` | New: integrate emission and absorption through a continuous scalar field, with slice, density, and view controls. Unlike the SDF playground, rays accumulate contributions throughout a volume rather than finding a surface. |
| `wave-sculpture` | Rebuilt as Tidal Loom: 4,096 instanced fins, local wave slopes, height colors, and a pointer-driven ripple. Teaches sampled geometry and instance transforms. |
| `flocking-boids` | Rebuilt as Murmuration: 900 birds, 1,800 instanced wings, spatial bins, simultaneous Reynolds steering, bounded fixed timesteps. Teaches neighborhood acceleration and emergent behavior. |
| `hello-cube`, `tutorial-01-geometry` … `tutorial-05-interaction` | Keep. The cube is the minimal lifecycle contract; the tutorials isolate geometry, lights, animation, color, and interaction in sequence. Their simplicity is educationally useful. |
| `mobius-strip`, `penrose-tiles`, `recursive-spirals`, `fractal-tree` | Keep. Surface topology, aperiodic subdivision, recursive composition, and branching generation are different constructions. Old Growth already has a developed visual identity. |
| `aurora`, `color-fields`, `neon-city` | Keep. Atmospheric ribbons, continuous pigment deformation, and procedural architecture/material lighting use different scene structures. |
| `shader-gallery`, `shader-playground` | Keep. UV image functions compared in a gallery versus SDF surface raymarching. Shared use of GLSL is not duplicate teaching content. |
| `terrain-flyover`, `camera-journey` | Keep. Heightfield generation and altitude colors versus spline camera choreography; the terrain camera is not the terrain's main lesson. |
| `flow-field`, `strange-attractor` | Keep. Spatial vector-field advection versus a trajectory through a low-dimensional chaotic dynamical system. |
| `reaction-diffusion`, `fluid-2d` | Keep. Chemical pattern formation versus incompressible flow on a grid. A shared texture visualization does not make the solvers interchangeable. |
| `canvas-2d`, `pixel-sort` | Keep. Canvas-to-texture bridging versus luminance ordering and controlled image corruption. |
| `orbital-dance`, `n-body-gravity`, `solar-system` | Keep. Authored orbital choreography, interacting gravitational bodies/merging, and a reference planetary system/camera journey are distinct. Do not label authored motion as gravity simulation. |
| `force-field-playground` | Keep separate from Ember Engine: users place multiple field regions and inspect local force effects. It remains the ParticleWorld/emitter-wrapper lesson. |
| `domino-chain`, `marble-run`, `cloth-sim`, `voronoi-shatter` | Keep. Contact propagation, constrained ramp collisions, Verlet constraints, and computational geometry coupled to fragment motion. |
| `audio-pulse`, `audio-terrain`, `music-visualizer` | Keep as a progression: basic microphone acquisition/amplitude, frequency-to-terrain mapping, and beat/band visualization. Audio Pulse is a deliberate beginner scaffold; richer FFT examples should not replace the first permission/input lesson. |
| `music-synth`, `synth-keyboard`, `bell-orrery` | Keep. Generative sequencing, direct note interaction, and spatialized polyrhythm respectively. |
| `video-fx`, `video-kaleidoscope`, `chroma-mirror` | Keep. Side-by-side image operators/recording, polar UV folding, and transparent foreground/background compositing respectively. The actual Video FX implementation has raw/pixelate/glitch/edge panels; its old description incorrectly claimed chroma key. |
| `video-broadcast`, `motion-scale-lantern` | Keep. Broadcast typography/recording overlays versus motion-derived geometry articulation. |
| `data-sculpture`, `typography-art`, `ui-showcase` | Keep. Data-to-geometry interaction, procedural architectural lettering, and DOM/3D overlay primitives. |
| `printable-bracket`, `tide-eroded-vessel` | Keep. A dimensioned functional CSG part versus generative printable erosion. |
| `long-winter` | Keep. Northern Light is a nine-act, music-synchronized demoscene with reflected fjords and ray-traced sculptures. It integrates production staging rather than replacing focused optics or scalar-volume lessons. |
| `signal-salvage` | Keep. Integrates game state, input, score, media, and evolving music; it is a capstone rather than a replacement for its prerequisite lessons. |

## Common core and TypeScript

The existing `Scene` / `defineScene` hierarchy owns independently reusable
components through `ResourceScope`. This refresh builds on that hierarchy:
`instances()` uses `InstanceField`, and `shaderPanel()` uses `ShaderSurface`'s
new projected-plane option. It does not introduce a second scene or ownership
system. The existing source browser, editable JS/TS module graph, export/reopen
workflow, and Long Winter production are preserved.

`Sketch<State>` / `SketchContext<State>` add checked module and state contracts
for low-level sketches. The refreshed numerical/GPU sketches use strict checked
JSDoc and inferred Three.js types while remaining native browser modules. The
IDE also continues to compile authored TypeScript modules through its existing
ModuleCompiler. TypeScript remains a runtime dependency for that compiler.

Both browser hosts continue to use the existing `SceneContext` class. It now
has strict checked bindings and exposes its existing `ResourceScope` as
`ctx.scope`, so functional sketches can use the same ownership model as scene
classes. StandaloneRunner gains explicit stop/dispose, setup-failure cleanup,
and protection against superseded setup. Its replacement path awaits async
teardown and scope completion. Preview retains the upstream compiler and
serialized teardown, and resets background/fog on scene transitions.

Reusable functions live in `src/stdlib/sketch.js`:

| Helper | Responsibility |
|---|---|
| `stage`, `skyDome` | Camera target, background, key/rim lighting, bloom, procedural sky |
| `instances` | Dynamic instance buffer and animated-bounds policy |
| `shaderPanel` | Shared plane/UV shader scaffolding |
| `pointer` | Canvas-local normalized pointer coordinates and scoped listener |
| `controlPanel` | Labelled sliders, value displays, and scoped DOM removal |
| `seededRandom` | Reproducible local randomness |
| `fixedStep` | Fixed simulation dt, bounded catch-up after background tabs |
| `SpatialHash` | Generic neighborhood bins for spatial simulations |

`ctx.scope` owns listeners and non-scene resources. `ctx.add()` registers scene
roots; the host recursively disposes geometry, materials, uniform textures,
instanced mesh resources, and nested labels on unload, deduplicating shared
resources within that graph. `ctx.remove()` transfers responsibility back to
the caller: explicitly removed resources must be disposed by their owner.
Do not share resources across independently owned sketches. Teardown releases
non-scene activity through the scope; the host disposes registered scene roots.

The CLI now scaffolds a native `main.js` lifecycle module using the shared
context and scoped input, replacing its obsolete `.art` syntax scaffold.

The gallery and its browser smoke suite now consume the same catalog. A new
entry cannot silently miss the browser sweep because somebody forgot a second
hardcoded list.

## Verification and practical limits

`npm run typecheck` runs strict checking on the opted-in core and refreshed
sketches, not on the entire legacy application. CI includes that gate alongside
lint, unit tests, production build, and Playwright. Numerical tests cover
interference cancellation, absorption subdivision, display-rate-independent
flocking, spatial queries against brute force, bounded catch-up, and cleanup.
Browser tests inspect composited canvas pixels, exercise controls, navigate
away, test old links, and run the actual standalone class through successful,
failed, and superseded setup. Screenshots are retained in Playwright output.

The 4,096/1,800/2,400 instance counts are rendering budgets, not measured FPS
claims. WebGL browser validation does not qualify WebGPU, mobile GPUs, or media
capture. The volume shader uses 96 fixed midpoint samples and is an educational
emission/absorption model, not a scientific tomography tool. Interference uses
equal-amplitude coherent sources in a plane, not a full optical propagation
solver.

Local qualification on 2026-10-28 used Node 22.23.4 and Playwright's matched
Chromium 147: lint, strict type checking, production build, and 523 Vitest tests
passed. The complete 77-case browser suite passed with a clean exit, including
JS/TS workspace editing, export/reopen, and all Northern Light acts. The phase
sign correction additionally passed its focused production-browser check.
Screenshots were inspected and are attached to the browser report. No native-GPU
throughput claim is inferred from these tests.

## Follow-up migration context

The framework implementation remains mostly JavaScript, alongside the existing
JS/TS authoring compiler. Some legacy demos still use
module globals, bespoke UI, hand-written teardown, and variable-step updates.
They now receive the shared context, but have not all been rewritten to use its
scope and helpers. Migrate them when their feature changes, with real input and
unload coverage, rather than claiming that a type declaration makes them safe.

Monaco still suppresses semantic diagnostics, and ModuleCompiler transpiles
TypeScript rather than constructing a fully typechecked program. The strict CI
gate covers opted-in source modules; it does not make in-browser authoring a
semantic type-checking environment. An opt-in editor diagnostics service using
the shared contracts is a separate migration step.

The renderer directory's `IRenderer`/WebGPU/WebGL backend hierarchy is bypassed
by the active preview and standalone hosts, which construct Three.WebGLRenderer
and a bloom composer directly. A future backend change needs a typed rendering
capability contract and backend-specific material/postprocessing tests; switching
the IDE to that hierarchy without those checks would overstate WebGPU support.
`IPhysicsWorld` also mixes required world operations with optional no-op rigid
body hooks. Split optional capabilities and use discriminated body descriptors
before enabling strict checking across those legacy backends.

Next useful visual/architecture work: migrate media gesture cancellation and
late stream acquisition into scoped lifecycle helpers, give the fluid and cloth
lessons a stronger composition, and qualify scalable quality presets on mobile
hardware. Keep beginner lessons legible. These are follow-up improvements, not
claimed results of this refresh.
