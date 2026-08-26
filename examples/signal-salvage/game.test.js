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
