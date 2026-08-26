# Signal Salvage design

## Goal

Signal Salvage is a 90-second score-attack game that combines Artlab's
camera, microphone, procedural audio, particles, UI, and Three.js rendering
in one example. Sensor input enhances play, while keyboard controls and
procedural textures keep the game fully playable when media permission is
unavailable or denied.

## Experience

The player pilots a bioluminescent spore skiff through a living nebula.
Translucent signal fragments use the webcam feed as a refracted membrane;
corruption blooms damage the player. Collecting fragments builds score and a
combo multiplier. Three escalating waves culminate in a signal storm.

Controls:

- WASD or arrow keys steer.
- Space charges and releases a pulse that attracts fragments and repels
  hazards.
- P pauses or resumes.
- R restarts after game over.

The HUD shows score, combo, time, wave, health, pulse charge, and camera and
microphone status. Onboarding explains controls and that media is processed
locally and never retained.

## Media and audio

A single user-gesture button starts Tone.js and requests camera and
microphone access independently. Camera frames provide the fragment texture
and low-resolution motion steering. Microphone RMS energy accelerates pulse
charging and increases the harmonic density of a pentatonic ambient score.
The microphone signal is analyzed only; it is never played, recorded,
uploaded, or retained.

Permission failures are non-fatal:

- Keyboard input always provides complete steering.
- Holding Space charges the pulse without a microphone.
- A generated color-noise texture replaces unavailable webcam video.
- Tone startup failure leaves a playable silent game with visible status.

## Architecture

`game.js` is a deterministic model for game state, waves, scoring, spawning,
movement, sphere collisions, and pulse behavior. `media-input.js` normalizes
camera motion and microphone energy. `soundtrack.js` owns all Tone.js nodes
and musical events. `scene.js` owns Three.js resources and pooled entities.
`signal-salvage.js` coordinates those modules through Artlab's
`setup`/`update`/`teardown` lifecycle.

Each frame converts keyboard and sensor data into one normalized input,
advances the model with a clamped delta, then applies model state and emitted
events to the scene and soundtrack.

## Performance limits

- Sample camera motion from a 32 by 24 buffer at no more than 15 Hz.
- Use one webcam texture.
- Pool fragments and hazards with fixed caps.
- Reuse vectors and particle buffers in the update loop.
- Bound particle counts and avoid per-frame DOM creation.
- Update HUD text only when its displayed value changes.

## Lifecycle and errors

The lifecycle is `ready`, `requesting-media`, `playing`, `paused`, and
`game-over`. Media requests use independent failure handling. Startup and
teardown are idempotent. Teardown stops every media track, disconnects and
disposes every audio node, removes all event listeners and DOM overlays, and
disposes scene resources. Restart reuses granted streams rather than asking
for permission again.

## Acceptance criteria

- A complete 90-second keyboard-only game works without media devices.
- Camera motion influences steering and webcam video textures fragments when
  camera access is available.
- Microphone energy influences pulse charging and the soundtrack when
  microphone access is available.
- Music and game cues reach the Tone.js destination after the start gesture.
- Entity counts stay within fixed caps throughout repeated runs.
- Permission denial is visible but never crashes or blocks play.
- Pause and restart preserve valid state transitions.
- Switching examples leaves no media tracks, audio, listeners, HUD, or scene
  resources behind.
- Unit, lifecycle, lint, production build, and browser smoke tests pass.
