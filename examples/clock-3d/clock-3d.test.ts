// @vitest-environment jsdom
import { test, expect, vi, afterEach } from 'vitest'
import { makeContext } from '../../tests/context.ts'
import { setup, update, teardown } from './clock-3d.ts'
afterEach(() => { vi.useRealTimers(); document.body.replaceChildren() })

test('analog and kinetic representations agree on time and switch without a reload', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 9, 28, 3, 30, 0, 0))
  const ctx = makeContext()
  setup(ctx); update(ctx, 0)
  const clock = ctx.scene.children.find(o => o.isGroup)
  const [analog, kinetic] = clock.children
  expect(kinetic.children[0].rotation.z).toBeCloseTo(-3.5 / 12 * Math.PI * 2)
  expect(kinetic.children[1].rotation.z).toBeCloseTo(-Math.PI)
  expect(analog.visible).toBe(true)
  const style = document.querySelector('input')
  style.value = '1'; style.dispatchEvent(new Event('input'))
  expect(analog.visible).toBe(false)
  expect(kinetic.visible).toBe(true)
  teardown(ctx); ctx.dispose()
  expect(ctx.scene.children).toHaveLength(0)
})
