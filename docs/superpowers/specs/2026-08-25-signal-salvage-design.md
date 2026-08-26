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

The entity mix changes throughout every run. Memory seeds build the normal
score and combo, resonance blooms amplify pulse strength, prism shards grant a
short score multiplier, and rare repair spores restore health. A seeded chaos
director starts a telegraphed event every 6–12 seconds. Debris streams,
corruption swarms, gravity wells, blackout surges, and signal storms alter
movement, visibility, speed, or spawn density for 4–8 seconds. At most two
compatible modifiers overlap, keeping surprising runs fair and reproducible.

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
microphone access independently. Camera frames texture prism shards and a
large translucent signal veil. Low-resolution camera motion produces ripples,
glow, and turbulence but does not steer the craft. Microphone RMS energy
accelerates pulse charging, expands the craft aura, brightens the world, and
opens the soundtrack filter.

The soundtrack contains 6–8 four-chord harmonic scenes with alternate
voicings, bass patterns, and sparse motifs. A different scene is selected at
each four-measure boundary, approximately every 9–11 seconds over the game's
tempo range. Immediate scene repeats are excluded. Chaos events may change
orchestration and rhythm, but harmonic changes never occur between bars.
The microphone signal is analyzed only; it is never played, recorded,
uploaded, or retained.

Permission failures are non-fatal:

- Keyboard input always provides complete steering.
- Holding Space charges the pulse without a microphone.
- A generated color-noise texture replaces unavailable webcam video.
- Tone startup failure leaves a playable silent game with visible status.

## Architecture

`game.js` is a deterministic model for game state, waves, scoring, spawning,
the chaos director, typed entities, movement, sphere collisions, and pulse
behavior. `media-input.js` normalizes camera motion and microphone energy.
`soundtrack.js` owns all Tone.js nodes, bar-aligned harmonic scenes, and
musical events. `scene.js` owns Three.js resources, the signal veil, sensor
effects, and pooled entities.
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
- Keyboard input is the only steering control.
- Camera video textures the signal veil and prism shards; camera motion
  visibly drives ripples and turbulence when camera access is available.
- Microphone energy visibly influences pulse charging, aura, world intensity,
  and the soundtrack when microphone access is available.
- The HUD and onboarding explicitly name each sensor's effect and expose live
  camera-motion and microphone-energy feedback.
- Four collectible types and five telegraphed chaos events produce varied,
  seeded runs without exceeding the fixed entity caps.
- The soundtrack changes to a non-repeating harmonic scene every four measures
  without cutting across a bar.
- Music and game cues reach the Tone.js destination after the start gesture.
- Entity counts stay within fixed caps throughout repeated runs.
- Permission denial is visible but never crashes or blocks play.
- Pause and restart preserve valid state transitions.
- Switching examples leaves no media tracks, audio, listeners, HUD, or scene
  resources behind.
- Unit, lifecycle, lint, production build, and browser smoke tests pass.
