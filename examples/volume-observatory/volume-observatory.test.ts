// @vitest-environment jsdom
import { expect, test } from 'vitest'
import { containerOf, initialize, makeContext } from '../../tests/context.ts'
import { opacity, setup, teardown, update } from './volume-observatory.ts'

test('absorption is invariant when a segment is subdivided', () => {
  const whole = opacity(8, 0.4)
  const half = opacity(8, 0.2)
  expect(1 - (1 - half) ** 2).toBeCloseTo(whole)
  expect(opacity(0, 1)).toBe(0)
  expect(opacity(2, 1)).toBeLessThan(opacity(8, 1))
})
test('cut controls update the material and are removed on teardown', () => {
  const ctx = initialize(setup, makeContext()); update(ctx, 1 / 60)
  const cut = containerOf(ctx).querySelectorAll('input')[1]
  cut.value = '0'; cut.dispatchEvent(new Event('input'))
  expect(ctx.state.uniforms.cut.value).toBe(0)
  teardown(ctx); ctx.dispose()
  expect(ctx.scene.children).toHaveLength(0)
  containerOf(ctx).remove()
})
