# Long Winter — production direction

Status: implemented as the `long-winter` example. It uses an original synthesized
tracker-style score, so the production has no external music or asset license.

The flagship is a roughly two-minute performance with a strong melody,
deliberate musical changes, a mischievous character, and a technical climax. One Start
button begins the show. The first viewing should require no IDE knowledge or media
permissions. The code view should reveal an equally deliberate composition underneath.

## The performance

| Passage | Visual idea | Musical relationship | Engineering demonstration |
|---|---|---|---|
| Invitation | A tiny stage, color bands, a character, greetings | Establish the tune and its four instrumental voices | Compact assets and a comprehensible initial scene |
| First break | The character tears open the backdrop; camera dives inside | A transition on a specific pattern and row | A small stage reveals a much larger procedural world |
| Expansion | Architecture folds into swarms and fluid-looking forms | Bass phrases shape geometry; percussion triggers accents | Instanced geometry, reusable buffers, shader work |
| Personal reveal | Optional camera image becomes a moving sculpture | Melody and character gesture address the viewer | Live media becomes part of the world; a procedural fallback preserves the show |
| Climax | Several visual systems combine with a coherent silhouette | Layers accumulate through a planned musical build | Measured workload at a defined frame-time budget |
| Return | The original character and stage reappear, followed by credits | Resolve the opening phrase | Show actual object counts, frame timings, asset size, and source links |

The exact scenes should follow the chosen tune. Long Winter uses an original score
written directly as patterns and synthesized in the browser.
The song is a collaborator, not background wallpaper. A historical module should be
replayed with its timing/effects intact, not approximated by FFT pulses.

## Visual identity and the browser surprise

Begin with a restrained palette: winter blue, warm amber, and paper white. The opening
character could be a tiny maintenance robot tending a light through the winter. It
taps a foot, impatiently waits for an instrumental entrance, then pulls a loose pixel
from the backdrop. That pixel becomes the doorway into the larger world. Its tricks
introduce transitions and give the audience something to anticipate.

Keep the opening's sprite edges and color bands deliberate. As the camera crosses the
doorway, those bands become continuous surfaces and impossible depth. The contrast in
scale makes the reveal readable. Repeat recognizable shapes through later passages:
the robot's lamp becomes a sun, a swarm, and finally the lamp again. Avoid filling every
moment with every available effect; the finale needs room to exceed what came before.

Artlab already supplies ingredients in Shader Playground and Shader Gallery, Flow
Field, Particle Storm, the physics examples, and the live-media examples. The missing
piece is a single authored performance that makes those capabilities cooperate.
The proposed surprise has three stages:

1. **Scale:** a small stage opens into architecture and thousands of moving forms.
2. **Transformation:** the same forms visibly become a different material or system,
   preserving continuity across the transition.
3. **Understanding:** after the show, the viewer opens a short composition, follows a
   class into its implementation, changes one rule, and runs their own version.

The third stage is distinctly Artlab. Give the finished show **Watch**, **Explore the
score**, and **Open this part** entry points. A tracker view can reveal instrument
activity alongside the corresponding visual cues; a source link can open the class
responsible for the effect currently on screen. Keep timing and workload instrumentation
available to curious viewers, with a compact measured summary in the credits.

Live camera input is an optional second viewing variation. The first viewing should
run with one gesture and no permission interruption. Any chosen tune and every
included asset should have clear redistribution terms and visible credits.

## Proposed class boundaries

- `TrackerTransport`: owns decoding/playback; exposes audible song time, pattern, row,
  and instrument events. Audio time is the master clock.
- `Score`: maps musical positions to parts, camera cues, transitions, and character actions.
- `Part`: owns one composed Scene and its resources; supports deterministic seeking.
- `Character`: a small animated performer with a finite set of expressive actions.
- Existing `Scene`, `InstanceField`, `ParticleField`, `Trail`, `ShaderSurface`, and
  `ResourceScope`: the visual and lifecycle machinery already available.

A production entry should mostly name parts, select a score, and bind musical cues.
Effects should be runnable separately through little example compositions so users
can experiment with a single instrument or visual mechanism.

Prefer composition over a large effect superclass. A transition combines two parts;
a character action does not belong in the particle engine; tracker decoding does not
belong in the score. Each class should be worth opening and understanding independently.

## Timing and performance criteria

Use an audio-derived playhead, accounting for scheduling/output latency. Drive scene
selection from absolute musical position so dropped frames do not accumulate timing
error. Test pause/resume, seek, tab suspension, and device/audio failures. The first
implementation should prove reliable musical synchronization before multiplying effects.

Choose a baseline machine and resolution, then establish a frame-time budget. Track
frame-time distributions, draw calls, allocation, and particle/instance counts. Prewarm
shaders and prepare transitions before their cue. Adapt resolution or density when the
budget cannot be met, while keeping musical timing and composition intact.

A proposed workload is not a performance claim. Publish measured results, including
machine, browser, resolution, and which rendering path ran. WebGPU may provide a more
ambitious path later; the visual direction should still work with a WebGL2 baseline.

## Implemented decisions

1. The 112 BPM, 48-bar original score has four voices and six named passages.
2. Pip, the maintenance robot, pulls a pixel from the stage; architecture transforms
   continuously into a swarm and a sun before returning to the opening stage.
3. `TrackerTransport`, the score, character, world, swarm, and overlay are separate,
   editable modules. Audio time is authoritative, with a silent-clock fallback.
4. The credits report live p95 frame time and draw calls for the current browser,
   resolution, rendering path, active instance count, and zero external assets. The
   show reduces the 1,400-instance workload when its rolling p95 exceeds 20 ms.
