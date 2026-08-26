import { describe, expect, it } from 'vitest'
import {
  GAME_DURATION,
  MAX_FRAGMENTS,
  MAX_HAZARDS,
  createGame,
  restartGame,
  startGame,
  stepGame,
  togglePause,
} from './game.js'

const idleInput = { x: 0, y: 0, pulseHeld: false, pulseReleased: false, micEnergy: 0 }

function fixedRandom(...values) {
  let index = 0
  return () => values[index++ % values.length]
}

describe('Signal Salvage game model', () => {
  it('starts a fresh 90-second mission', () => {
    const state = createGame({ random: fixedRandom(0.5) })

    startGame(state)

    expect(state.phase).toBe('playing')
    expect(state.timeRemaining).toBe(GAME_DURATION)
    expect(state.health).toBe(3)
    expect(state.score).toBe(0)
  })

  it('clamps steering to the flight bounds', () => {
    const state = createGame({ random: fixedRandom(0.5) })
    startGame(state)

    stepGame(state, { ...idleInput, x: 8, y: -8 }, 10)

    expect(state.player.x).toBe(6)
    expect(state.player.y).toBe(-3.5)
  })

  it('advances through three waves and ends after 90 seconds', () => {
    const state = createGame({ random: fixedRandom(0.5) })
    startGame(state)

    stepGame(state, idleInput, 31)
    expect(state.wave).toBe(2)
    stepGame(state, idleInput, 30)
    expect(state.wave).toBe(3)
    const events = stepGame(state, idleInput, 29)

    expect(state.phase).toBe('game-over')
    expect(state.timeRemaining).toBe(0)
    expect(events).toContainEqual({ type: 'game-over' })
  })

  it('never spawns more than the fixed entity caps', () => {
    const state = createGame({ random: fixedRandom(0.1, 0.4, 0.8) })
    startGame(state)

    for (let i = 0; i < 2000; i++) stepGame(state, idleInput, 0.05)

    expect(state.fragments.length).toBeLessThanOrEqual(MAX_FRAGMENTS)
    expect(state.hazards.length).toBeLessThanOrEqual(MAX_HAZARDS)
  })

  it('collects fragments, increases combo, and expires the combo', () => {
    const state = createGame({ random: fixedRandom(0.5) })
    startGame(state)
    state.fragments.push({ id: 1, x: 0, y: 0, z: -0.1, active: true })

    const events = stepGame(state, idleInput, 0.02)

    expect(state.score).toBe(100)
    expect(state.combo).toBe(2)
    expect(events).toContainEqual({ type: 'collected', combo: 2 })

    stepGame(state, idleInput, 3.1)
    expect(state.combo).toBe(1)
  })

  it('gives each collectible type a distinct reward', () => {
    const state = createGame({ random: fixedRandom(0.5) })
    startGame(state)
    state.health = 2
    state.fragments.push(
      { id: 1, kind: 'resonance', x: 0, y: 0, z: -0.1, active: true },
      { id: 2, kind: 'prism', x: 0, y: 0, z: -0.1, active: true },
      { id: 3, kind: 'repair', x: 0, y: 0, z: -0.1, active: true },
    )

    const events = stepGame(state, idleInput, 0.02)

    expect(state.resonanceFor).toBeGreaterThan(0)
    expect(state.scoreMultiplier).toBe(2)
    expect(state.health).toBe(3)
    expect(events.filter(event => event.type === 'collected').map(event => event.kind))
      .toEqual(['resonance', 'prism', 'repair'])
  })

  it('telegraphs the first anomaly at the same time in every mission', () => {
    // Later anomalies are randomly spaced, but a first one that can arrive
    // anywhere between 4.5s and 10.5s leaves players unsure the telegraph
    // exists at all, and leaves the browser test with no bounded wait.
    for (const seed of [0, 0.5, 0.99]) {
      const state = createGame({ random: fixedRandom(seed) })
      startGame(state)
      state.spawnFragmentIn = 100
      state.spawnHazardIn = 100

      expect(stepGame(state, idleInput, 4.4)).not.toContainEqual(
        expect.objectContaining({ type: 'event-warning' }),
      )
      expect(stepGame(state, idleInput, 0.2)).toContainEqual(
        expect.objectContaining({ type: 'event-warning' }),
      )
    }
  })

  it('telegraphs seeded chaos events and excludes incompatible overlaps', () => {
    const state = createGame({ random: fixedRandom(0.99) })
    startGame(state)
    state.spawnFragmentIn = 100
    state.spawnHazardIn = 100
    state.activeEvents.push({ type: 'blackout', remaining: 5 })
    state.nextEventIn = 0

    const warning = stepGame(state, idleInput, 0.02)
    expect(warning).toContainEqual(expect.objectContaining({ type: 'event-warning' }))
    expect(state.eventWarning).not.toBe('signal-storm')

    const started = stepGame(state, idleInput, 1.5)
    expect(started).toContainEqual(expect.objectContaining({ type: 'event-started' }))
    expect(state.activeEvents).toHaveLength(2)
    expect(state.activeEvents.map(event => event.type)).not.toContain('signal-storm')
  })

  it('naturally overlaps compatible events while keeping the two-event cap', () => {
    const state = createGame({ random: fixedRandom(0.99, 0, 0, 0) })
    startGame(state)
    state.spawnFragmentIn = 100
    state.spawnHazardIn = 100
    state.nextEventIn = 0

    stepGame(state, idleInput, 0.01)
    stepGame(state, idleInput, 1.5)
    stepGame(state, idleInput, 4.5)
    stepGame(state, idleInput, 1.5)

    expect(state.activeEvents).toHaveLength(2)
  })

  it('changes spawn density and trajectories while chaos events are active', () => {
    const baseline = createGame({ random: fixedRandom(0.5) })
    const state = createGame({ random: fixedRandom(0.5) })
    startGame(baseline)
    startGame(state)
    state.activeEvents.push(
      { type: 'signal-storm', remaining: 5 },
      { type: 'gravity-well', remaining: 5 },
    )
    state.fragments.push({ id: 1, kind: 'memory', x: 4, y: 2, z: -20, active: true })
    baseline.spawnFragmentIn = 0
    baseline.spawnHazardIn = 100
    baseline.nextEventIn = 100
    state.spawnFragmentIn = 0
    state.spawnHazardIn = 100
    state.nextEventIn = 100

    stepGame(state, idleInput, 0.5)
    stepGame(baseline, idleInput, 0.5)

    expect(state.spawnFragmentIn).toBeLessThan(baseline.spawnFragmentIn)
    expect(state.fragments[0].x).toBeLessThan(4)
    expect(state.fragments[0].y).toBeLessThan(2)
    expect(state.fragments[0].z).toBeGreaterThan(-13.5)
  })

  it('lets resonance boost a fully charged pulse beyond normal strength', () => {
    const state = createGame({ random: fixedRandom(0.5) })
    startGame(state)
    state.resonanceFor = 5
    state.pulseCharge = 1

    const events = stepGame(state, { ...idleInput, pulseReleased: true }, 0.01)

    expect(events.find(event => event.type === 'pulse').strength).toBeGreaterThan(1)
  })

  it('takes damage from a hazard and ends when health reaches zero', () => {
    const state = createGame({ random: fixedRandom(0.5) })
    startGame(state)

    for (let hit = 0; hit < 3; hit++) {
      state.invulnerableFor = 0
      state.hazards.push({ id: hit + 1, x: 0, y: 0, z: -0.1, active: true })
      stepGame(state, idleInput, 0.02)
    }

    expect(state.health).toBe(0)
    expect(state.phase).toBe('game-over')
  })

  it('charges faster with microphone energy and emits a pulse on release', () => {
    const state = createGame({ random: fixedRandom(0.5) })
    startGame(state)

    stepGame(state, { ...idleInput, pulseHeld: true, micEnergy: 1 }, 0.5)
    const charged = state.pulseCharge
    const events = stepGame(state, { ...idleInput, pulseReleased: true }, 0.01)

    expect(charged).toBeGreaterThan(0.5)
    expect(state.pulseCharge).toBe(0)
    expect(events[0].type).toBe('pulse')
    expect(events[0].strength).toBeCloseTo(charged)
  })

  it('pulls fragments toward the player and pushes hazards away', () => {
    const state = createGame({ random: fixedRandom(0.5) })
    startGame(state)
    state.player.x = 4
    state.player.y = 2
    state.pulseCharge = 1
    state.fragments.push({ id: 1, x: 0, y: 0, z: -5, active: true })
    state.hazards.push({ id: 2, x: 3, y: 2, z: -5, active: true })

    stepGame(state, { ...idleInput, pulseReleased: true }, 0.01)

    expect(state.fragments[0].x).toBeGreaterThan(0)
    expect(state.fragments[0].y).toBeGreaterThan(0)
    expect(state.hazards[0].x).toBeLessThan(3)
  })

  it('does not advance while paused and restarts cleanly', () => {
    const state = createGame({ random: fixedRandom(0.5) })
    startGame(state)
    stepGame(state, idleInput, 2)
    togglePause(state)
    const remaining = state.timeRemaining

    stepGame(state, idleInput, 5)
    expect(state.timeRemaining).toBe(remaining)

    state.score = 900
    state.health = 1
    restartGame(state)
    expect(state.phase).toBe('playing')
    expect(state.score).toBe(0)
    expect(state.health).toBe(3)
    expect(state.fragments).toHaveLength(0)
    expect(state.hazards).toHaveLength(0)
  })
})
