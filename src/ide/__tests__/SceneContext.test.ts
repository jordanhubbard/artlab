// @vitest-environment jsdom
import { it, expect, vi } from 'vitest'
import * as Three from 'three'
import { makeContext } from '../../../tests/context.ts'

it('provides the modeling helpers required by preview and standalone sketches', () => {
  const ctx = makeContext()
  for (const name of ['sphere', 'box', 'mesh', 'point', 'noise2', 'vec3', 'range', 'loadTexture'] as const) {
    expect(typeof ctx[name]).toBe('function')
  }
  expect(ctx.box().isBufferGeometry).toBe(true)
  ctx.renderer.domElement.parentElement?.remove()
})

it('allows destructured add/remove and releases late additions to a disposed context', async () => {
  const ctx = makeContext()
  const scene = ctx.scene
  const { add, remove } = ctx
  const object = new Three.Mesh(new Three.BoxGeometry(), new Three.MeshBasicMaterial())
  add(object); remove(object)
  expect(ctx._added).toHaveLength(0)
  add(object)
  const dispose = vi.spyOn(object.geometry, 'dispose')
  await ctx.dispose()
  expect(scene.children).toHaveLength(0)
  expect(dispose).toHaveBeenCalledTimes(1)
  const late = new Three.Mesh(new Three.BoxGeometry(), new Three.MeshBasicMaterial())
  const lateDispose = vi.spyOn(late.material, 'dispose')
  add(late)
  expect(scene.children).toHaveLength(0)
  expect(lateDispose).toHaveBeenCalledTimes(1)
})
