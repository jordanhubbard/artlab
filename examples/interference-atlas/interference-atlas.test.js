// @vitest-environment jsdom
import { test, expect } from 'vitest'
import { makeContext } from '../../tests/context.js'
import { intensity, setup, update, teardown } from './interference-atlas.js'

test('equal path lengths interfere constructively; half-cycle phase cancels', () => {
  expect(intensity(3, 3, 1, 0)).toBeCloseTo(1)
  expect(intensity(3, 3, 1, Math.PI)).toBeCloseTo(0)
  expect(intensity(3, 3.5, 1, 0)).toBeCloseTo(0)
})
test('phase controls update the material and are removed on teardown', () => {
  const ctx = makeContext()
  setup(ctx); update(ctx, 1 / 60)
  const phase = ctx.renderer.domElement.parentElement.querySelectorAll('input')[1]
  phase.value = '3.14'; phase.dispatchEvent(new Event('input'))
  expect(ctx.state.uniforms.phase.value).toBe(3.14)
  teardown(ctx); ctx.dispose()
  expect(ctx.renderer.domElement.parentElement.querySelector('section')).toBeNull()
  ctx.renderer.domElement.parentElement.remove()
})

test('asymmetric phases agree with the squared magnitude of the complex sum', () => {
  const distanceA = 3, distanceB = 3.25, wavelength = 1
  for (const phase of [0.4, 1.2, 4.5, -0.9]) {
    const a = 2 * Math.PI * distanceA / wavelength
    const b = 2 * Math.PI * distanceB / wavelength + phase
    const expected = ((Math.cos(a) + Math.cos(b)) ** 2 + (Math.sin(a) + Math.sin(b)) ** 2) / 4
    expect(intensity(distanceA, distanceB, wavelength, phase)).toBeCloseTo(expected)
  }
})
