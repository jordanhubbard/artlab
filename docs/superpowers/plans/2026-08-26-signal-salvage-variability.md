# Signal Salvage Variability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Signal Salvage musically evolving, mechanically unpredictable, and explicit about camera and microphone effects.

**Architecture:** Keep gameplay deterministic in `game.js`, schedule harmonic changes with Tone Transport in `soundtrack.js`, and render normalized media signals in `scene.js`. A bounded chaos director controls random events so surprise remains fair, reproducible, and pool-limited.

**Tech Stack:** JavaScript, Vitest, Three.js, Tone.js, Playwright

**Spec:** `docs/superpowers/specs/2026-08-25-signal-salvage-design.md`

## Global Constraints

- Camera and microphone initialization remain behind the existing start gesture.
- Keyboard remains the only steering input and must provide complete gameplay.
- Camera and microphone data remain local, unrecorded, and optional.
- Keep one video texture, 32×24 motion sampling at 15 Hz, fixed entity pools, and no per-frame resource allocation.
- Every behavior change follows a failing-test-first cycle.

---

### Task 1: Deterministic chaos director and typed collectibles

**Files:**
- Modify: `examples/signal-salvage/game.test.js`
- Modify: `examples/signal-salvage/game.js`

**Interfaces:**
- Produces entity `kind` values for memory, resonance, prism, repair, debris, corruption, and gravity hazards.
- Produces `state.activeEvents`, `state.eventWarning`, `state.scoreMultiplier`, and `state.resonanceFor`.
- Emits `event-warning`, `event-started`, `event-ended`, and typed `collected` events.

- [ ] Write failing tests for typed rewards, rare repair behavior, deterministic event selection, incompatible-event exclusion, telegraphing, and fixed caps.
- [ ] Run `npm test -- examples/signal-salvage/game.test.js` and confirm failures describe missing model behavior.
- [ ] Implement the smallest seeded director and typed reward/movement logic that passes.
- [ ] Re-run the game tests and refactor only while green.

### Task 2: Bar-aligned harmonic scenes

**Files:**
- Modify: `examples/signal-salvage/soundtrack.test.js`
- Modify: `examples/signal-salvage/soundtrack.js`

**Interfaces:**
- Harmonic scene selection occurs every `4m`.
- Pad chord playback remains every `1m`.
- Immediate scene repeats are excluded with an injected/randomized selector.

- [ ] Write failing tests proving four-measure scheduling, non-repeat selection, scene chord playback, and event-driven orchestration.
- [ ] Run `npm test -- examples/signal-salvage/soundtrack.test.js` and confirm expected failures.
- [ ] Implement progression banks, boundary scheduling, bass/motif layers, and disposal.
- [ ] Re-run soundtrack tests and refactor only while green.

### Task 3: Sensor effects and typed pooled visuals

**Files:**
- Modify: `examples/signal-salvage/scene.test.js`
- Modify: `examples/signal-salvage/scene.js`

**Interfaces:**
- `view.sync(state, events, dt, mediaSignals)` consumes `{ motion, micEnergy }`.
- `view.setTexture(texture)` applies one texture to the signal veil and prism material.

- [ ] Write failing tests for the veil texture, typed material selection, motion turbulence, mic aura, warning effects, and unchanged pool sizes.
- [ ] Run `npm test -- examples/signal-salvage/scene.test.js` and confirm expected failures.
- [ ] Implement shared typed materials/geometries, veil, aura, and bounded sensor effects.
- [ ] Re-run scene tests and refactor only while green.

### Task 4: Orchestration, onboarding, and HUD

**Files:**
- Modify: `examples/signal-salvage/signal-salvage.test.js`
- Modify: `examples/signal-salvage/signal-salvage.js`
- Modify: `examples/signal-salvage/artlab.json`
- Modify: `README.md`

**Interfaces:**
- `readInput` uses keyboard axes only.
- Scene receives media signals separately from gameplay input.
- HUD exposes motion, mic energy, active event, and sensor-purpose labels.

- [ ] Write failing lifecycle tests proving camera motion no longer steers and sensor purposes/meters are visible.
- [ ] Run `npm test -- examples/signal-salvage/signal-salvage.test.js` and confirm expected failures.
- [ ] Route media signals, update copy, metadata, and catalog text.
- [ ] Re-run lifecycle tests and refactor only while green.

### Task 5: Browser coverage and full verification

**Files:**
- Modify: `e2e/ide.spec.js`

- [ ] Add browser assertions for keyboard-only steering, changing HUD events, synthetic camera/mic feedback, texture presence, and teardown.
- [ ] Run the targeted Playwright Signal Salvage tests.
- [ ] Run `npm run lint`, `npm test`, `npm run build:artlab`, and `npm run test:e2e`.
- [ ] Review `git diff` for scope, resource lifecycle, accidental generated output, and documentation consistency.
