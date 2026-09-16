# Composable scenes and an editable environment

Artlab's examples are executable compositions. Their shared machinery is source code
that can be opened in the same editor, changed, and run with the composition.

## Explore, edit, run

1. Choose an example. Its manifest, entry, and local helper modules appear in the file list.
2. Open **Environment source** and search for a class such as `InstanceField`, `Trail`,
   `Scene`, or `MicrophoneInput`. Selecting a file opens an editable workspace copy.
3. Edit the composition, a helper, or a shared class. **Run** / Ctrl+Enter rebuilds the
   entry and its complete module graph from the current editor models.
4. Export the package to keep the modified source, its shared dependencies, and assets.
   Opening that ZIP runs the same composition. Project source also survives a reload.

Relative imports, re-exports, circular imports, extensionless JS/TS imports, and literal
local dynamic imports are bundled in the browser. TypeScript is transpiled on demand;
Run reports syntax/build errors, rather than performing a full TypeScript type check.
Dependencies such as Three and Tone remain separate vendor modules.

The active editor tab does not change the entry: editing a helper and pressing Run
runs the composition using that helper. Use a file's **Set as entry** menu action to
run another module that exports `setup`. A library class by itself needs a composition
that instantiates it.

The source browser includes Artlab's IDE and renderer implementation as well as the
stdlib. Changes affect modules imported by the running composition. Editing the IDE's
own controller does not hot-patch the already running host application; changing the
host itself still requires rebuilding Artlab. Third-party package internals are not
part of the editable source catalog.

## The composition contract

```js
import { Scene, defineScene } from '../../src/stdlib/scene.js'
import { EmberField } from './EmberField.js'

class ParticleStorm extends Scene {
  setup() {
    this.camera([0, 2, 14])
    this.ctx.setBloom(0.6)
    this.use(new EmberField({ count: 500, radius: 8 }))
  }
}

export const { setup, update, teardown } = defineScene(ParticleStorm)
```

`Scene` owns a `ResourceScope` and composes components. A component may expose:

- `object`: an Object3D to attach to the scene.
- `update(dt, elapsed)`: advance its state using seconds.
- `dispose()`: release its resources; it may return a promise.

`scene.use(component)` attaches, updates, and disposes a component. `scene.add(object)`
owns a plain Three object, including geometry, materials, textures, and nested children.
Override `update` only when orchestration is necessary; call `super.update(dt, elapsed)`
to continue updating components. `defineScene` adapts the class to Artlab's existing
lifecycle exports and keeps instances separate for different contexts.

Existing setup/update/teardown modules remain supported. Tutorials can continue to
show the underlying Three APIs directly. Stateless geometry and math operations remain
functions; classes represent objects with state, ownership, or a lifetime.

## Shared responsibilities

| Class | Owns | Example consumers |
|---|---|---|
| `Scene` | Component composition, camera framing, per-context lifecycle | Particle Storm, Flow Field, Shader Playground |
| `ResourceScope` | Object trees, unique resources, listeners, DOM, temporary settings, cleanup | Shader Gallery, Orbital Dance, Music Visualizer, Audio Terrain; all composed scenes |
| `ParticleField` | Fixed position/color buffers, a Points object, GPU upload flags | Flow Field, Orbital Dance starfield, Music Visualizer sparks |
| `InstanceField` | One mesh geometry/material, per-instance matrices and colors | Particle Storm's `EmberField` |
| `Trail` | Chronologically ordered history in fixed, mirrored storage | Bell Orrery, N-body Gravity |
| `ShaderSurface` | Fullscreen quad, time and drawing-buffer resolution uniforms | Shader Playground |
| `GestureButton` | Startup button, pending state, retry, removal | Audio Terrain, Music Visualizer |
| `MicrophoneInput` | Audio context, microphone stream, silent analyser graph, normalized bands | Audio Terrain, Music Visualizer |
| `SceneContext` | The common `ctx` API and fallback object cleanup | PreviewPane and StandaloneRunner |

Import the public scene barrel or a specific class file. Every implementation is under
`src/stdlib/scene/`; microphone analysis is in `src/stdlib/media.js`.

## Ownership rules

Give each resource one owner. Components dispose their own buffers and material;
`Scene.use` owns the component, not a second copy of its resources. `Scene.add` owns a
plain object's resource tree. Sharing a material or geometry within one ResourceScope
is supported and disposal happens once. Sharing owned resources between independent
scopes requires an explicit longer-lived owner.

`ResourceScope.listen`, `append`, and `set` register their inverse operation.
`defer` registers custom cleanup. Cleanup runs in reverse order, waits for asynchronous
work, and continues after a disposer throws. A late resource acquired after disposal
is immediately released. Microphone permission results that arrive after switching
examples have their tracks stopped without creating a new audio graph.

The preview waits for the outgoing module's asynchronous teardown before setting up
its successor, and ignores stale module loads. Legacy modules should still implement
teardown for resources outside `ctx.add`, especially streams and audio transports.

## Audit decisions

The pass reviewed the gallery's construction, update, interaction, audio/video, and
teardown patterns. Nine existing examples now consume the shared classes. Three of
those have small class-based entry modules; their artistic algorithms remain in named
local modules (`EmberField`, `FlowParticles`, and the raymarching fragment shader).

| Repeated pattern | Decision |
|---|---|
| Manual geometry/material disposal lists | Replace with resource ownership and recursive cleanup; deduplicate shared resources. |
| Hundreds of separate identical meshes | Use instancing where it preserves the intended image. Particle Storm now has one instanced object instead of 500 mesh objects. |
| Position/color BufferGeometry boilerplate | Use ParticleField; leave velocity fields and color rules in the composition's effect class. |
| Shifting trail arrays or drawing a ring buffer out of order | Use mirrored ring storage and a contiguous draw range. No buffer allocation or array shift per sample. |
| Fullscreen shader setup and window resize listeners | Use ShaderSurface; read the drawing-buffer size on update, including sidebar resizing. |
| Similar microphone graphs and permission buttons | Separate MicrophoneInput from GestureButton; share lifecycle behavior without coupling visuals to UI. |
| Different preview/standalone helper APIs | Build both contexts with SceneContext. Geometry, light, math, and vector helpers now match. |
| Loading only the entry into the editor | Load the example's local source modules and add library dependencies as the graph is compiled. |
| Running one blob with broken relative imports | Compile the editable graph with Rollup; preserve module origins for assets. |
| Repeated visual constants or short math expressions | Keep local when they describe artistic intent. A common superclass should not hide the artwork. |
| Existing physics, video, and geometry helpers | Reuse the current stdlib; avoid creating a second abstraction over working public APIs. |
| Specialized eclipse, printable geometry, game, and pigment algorithms | Keep domain-specific modules. They do not share one meaningful implementation merely because they use Three. |

The structural optimization is measurable without promising an unmeasured frame rate:
Particle Storm submits one instanced mesh per rendering pass; trails write two points
per sample instead of shifting the history. Actual frame time remains hardware- and
scene-dependent.

## Extending this structure

New effects should declare a small constructor interface, allocate buffers at setup,
and update existing state. Compose a class from smaller collaborators before introducing
inheritance beyond Scene or a specific buffer primitive. A useful shared abstraction
should have a clear resource boundary and hide repeated mechanics while exposing the
interesting parameters.

The demoscene proposal in [Long Winter](demoscene-direction.md) builds on this structure.
Its tracker transport and score timeline are design work, not implemented APIs.
