// @vitest-environment jsdom
import { test, expect } from 'vitest'
import { makeContext } from '../../tests/context.js'
import { opacity, setup, update, teardown } from './volume-observatory.js'

test('absorption is invariant when a segment is subdivided', () => {
  const whole = opacity(8, 0.4)
  const half = opacity(8, 0.2)
  expect(1 - (1 - half) ** 2).toBeCloseTo(whole)
  expect(opacity(0, 1)).toBe(0)
  expect(opacity(2, 1)).toBeLessThan(opacity(8, 1))
})
test('cut controls update the material and are removed on teardown', () => {
  const ctx = makeContext()
  setup(ctx); update(ctx, 1 / 60)
  const cut = ctx.renderer.domElement.parentElement.querySelectorAll('input')[1]
  cut.value = '0'; cut.dispatchEvent(new Event('input'))
  expect(ctx.state.uniforms.cut.value).toBe(0)
  teardown(ctx); ctx.dispose()
  expect(ctx.scene.children).toHaveLength(0)
  ctx.renderer.domElement.parentElement.remove()
})
