// @vitest-environment jsdom
import { test, expect, afterEach } from 'vitest'
import { makeContext } from '../../tests/context.ts'
import { setup, update, teardown } from './flocking-boids.ts'
afterEach(() => document.body.replaceChildren())

test('fixed simulation ticks give the same flock at different display rates', () => {
  const a = makeContext(), b = makeContext()
  setup(a); setup(b)
  for (let i = 0; i < 60; i++) update(a, 1 / 60)
  for (let i = 0; i < 30; i++) update(b, 1 / 30)
  expect(a.state.birds.map(p => p.position.toArray())).toEqual(b.state.birds.map(p => p.position.toArray()))
  for (const bird of a.state.birds) {
    expect(bird.velocity.length()).toBeGreaterThanOrEqual(2.5 - 1e-8)
    expect(bird.velocity.length()).toBeLessThanOrEqual(6 + 1e-8)
    expect(bird.position.toArray().every(Number.isFinite)).toBe(true)
  }
  expect(a.state.wings.count).toBe(1800)
  teardown(a); a.dispose(); teardown(b); b.dispose()
  expect(document.querySelector('section')).toBeNull()
})
