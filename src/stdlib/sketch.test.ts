// @vitest-environment jsdom
import { test, expect, vi } from 'vitest'
import * as Three from 'three'
import { ResourceScope } from './scene/ResourceScope.ts'
import { seededRandom, fixedStep, SpatialHash, pointer } from './sketch.ts'
import { makeContext } from '../../tests/context.ts'

test('scope cleanup survives an error and removes listeners exactly once', async () => {
  const scope = new ResourceScope(), target = new EventTarget(), listener = vi.fn(), cleanup = vi.fn()
  scope.listen(target, 'ping', listener)
  scope.defer(cleanup)
  scope.defer(() => { throw new Error('test') })
  target.dispatchEvent(new Event('ping'))
  await expect(scope.dispose()).rejects.toThrow(AggregateError)
  target.dispatchEvent(new Event('ping'))
  // The completion promise retains the original failure on repeated disposal.
  expect(listener).toHaveBeenCalledTimes(1)
  expect(cleanup).toHaveBeenCalledTimes(1)
  const late = vi.fn()
  scope.defer(late)
  expect(late).toHaveBeenCalledTimes(1)
})

test('nested scene cleanup deduplicates shared geometry, materials, and uniform textures', async () => {
  const texture = new Three.Texture()
  const material = new Three.ShaderMaterial({ uniforms: { map: { value: texture } } })
  const geometry = new Three.BoxGeometry()
  const root = new Three.Group()
  root.add(new Three.Mesh(geometry, material), new Three.Mesh(geometry, material))
  const dispose = [texture, material, geometry].map(item => vi.spyOn(item, 'dispose'))
  const scope = new ResourceScope()
  scope.own(root)
  await scope.dispose()
  for (const spy of dispose) expect(spy).toHaveBeenCalledTimes(1)
})

test('spatial bins include all true neighbors across negative and positive cell boundaries', () => {
  const random = seededRandom(42)
  const items = Array.from({ length: 200 }, () => ({ position: new Three.Vector3(random() * 20 - 10, random() * 20 - 10, random() * 20 - 10) }))
  const grid = new SpatialHash(2)
  grid.rebuild(items)
  for (const item of items.slice(0, 20)) {
    const found = new Set()
    grid.query(item.position, 3.2, other => {
      if (item.position.distanceTo(other.position) <= 3.2) found.add(other)
    })
    const brute = new Set(items.filter(other => item.position.distanceTo(other.position) <= 3.2))
    expect(found).toEqual(brute)
  }
  grid.rebuild([])
  expect(grid.cells.size).toBe(0)
})

test('catch-up is bounded and canvas input cannot leak across unloads', () => {
  const step = vi.fn(), tick = fixedStep(step, 60, 5)
  tick(100)
  expect(step).toHaveBeenCalledTimes(5)
  const ctx = makeContext(), handler = vi.fn()
  pointer(ctx, handler)
  ctx.renderer.domElement.dispatchEvent(new MouseEvent('pointerdown', { clientX: 400, clientY: 300 }))
  expect(handler.mock.calls[0][0].toArray()).toEqual([0, 0])
  ctx.dispose()
  ctx.renderer.domElement.dispatchEvent(new MouseEvent('pointerdown'))
  expect(handler).toHaveBeenCalledTimes(1)
  ctx.renderer.domElement.parentElement.remove()
})
