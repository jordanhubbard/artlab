// @vitest-environment jsdom
import { test, expect, afterEach } from 'vitest'
import { makeContext } from '../../tests/context.js'
import { setup, update, teardown } from './physics-particles.js'
afterEach(() => document.body.replaceChildren())

test('fountain and vortex share a bounded pool and produce different trajectories', () => {
  const a = makeContext(), b = makeContext()
  setup(a); setup(b)
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
