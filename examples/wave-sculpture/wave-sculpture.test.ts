// @vitest-environment jsdom
import { test, expect, afterEach } from 'vitest'
import { makeContext } from '../../tests/context.ts'
import { setup, update, teardown, waveHeight } from './wave-sculpture.ts'
afterEach(() => document.body.replaceChildren())

test('the loom is populated on the first frame and reacts to its controls', () => {
  const ctx = makeContext()
  setup(ctx)
  const before = ctx.state.tiles.instanceMatrix.array.slice()
  expect(ctx.state.tiles.count).toBe(4096)
  expect([...before].every(Number.isFinite)).toBe(true)
  const speed = document.querySelectorAll('input')[1]
  speed.value = '0'; speed.dispatchEvent(new Event('input'))
  update(ctx, 0.05)
  expect(ctx.state.tiles.instanceMatrix.array).toEqual(before)
  speed.value = '1'; speed.dispatchEvent(new Event('input'))
  update(ctx, 0.05)
  expect(ctx.state.tiles.instanceMatrix.array).not.toEqual(before)
  teardown(ctx); ctx.dispose()
  expect(document.querySelector('section')).toBeNull()
  expect(ctx.scene.children).toHaveLength(0)
})

test('wave height is bounded across the installation domain', () => {
  for (let x = -8; x < 8; x += 0.2)
    expect(Math.abs(waveHeight(x, x * 0.3, 100, 1.6))).toBeLessThanOrEqual(1.25)
})
