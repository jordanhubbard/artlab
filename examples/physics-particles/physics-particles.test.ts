// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest'
import { initialize, makeContext } from '../../tests/context.ts'
import { setup, teardown, update } from './physics-particles.ts'
afterEach(() => document.body.replaceChildren())

test('fountain and vortex share a bounded pool and produce different trajectories', () => {
  const a = initialize(setup, makeContext()), b = initialize(setup, makeContext())
  b.state.mode = 1
  for (let i = 0; i < 60; i++) { update(a, 1 / 60); update(b, 1 / 60) }
  expect(a.state.particles).toHaveLength(2400)
  expect(b.state.particles[0].position.toArray()).not.toEqual(a.state.particles[0].position.toArray())
  for (const particle of b.state.particles) {
    expect(particle.position.toArray().every(Number.isFinite)).toBe(true)
    expect(particle.age).toBeLessThanOrEqual(particle.life)
  }
  teardown(a); a.dispose(); teardown(b); b.dispose()
  expect(a.scene.children).toHaveLength(0)
})
