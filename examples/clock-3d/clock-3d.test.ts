// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { makeContext, required } from '../../tests/context.ts';
import { setup, teardown, update } from './clock-3d.ts';
afterEach(() => { vi.useRealTimers(); document.body.replaceChildren() })

test('analog and kinetic representations agree on time and switch without a reload', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 9, 28, 3, 30, 0, 0))
  const ctx = makeContext()
  setup(ctx); update(ctx, 0)
  const clock = required(ctx.scene.children.find(o => o instanceof ctx.Three.Group))
  const [analog, kinetic] = clock.children
  expect(kinetic.children[0].rotation.z).toBeCloseTo(-3.5 / 12 * Math.PI * 2)
  expect(kinetic.children[1].rotation.z).toBeCloseTo(-Math.PI)
  expect(analog.visible).toBe(true)
  const style = required(document.querySelector('input'))
  style.value = '1'; style.dispatchEvent(new Event('input'))
  expect(analog.visible).toBe(false)
  expect(kinetic.visible).toBe(true)
  teardown(ctx); ctx.dispose()
  expect(ctx.scene.children).toHaveLength(0)
})
