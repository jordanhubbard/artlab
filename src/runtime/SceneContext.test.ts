// @vitest-environment jsdom
import { test, expect, vi } from 'vitest'
import * as Three from 'three'
import { makeContext } from '../../tests/context.ts'

test('the shared context provides geometry and math constructors', () => {
  const ctx = makeContext()
  expect(ctx.mesh(ctx.box())).toBeInstanceOf(Three.Mesh)
  expect(ctx.range(3)).toEqual([0, 1, 2])
  expect(ctx.range(3, 3)).toEqual([])
  expect(ctx.range(3, 5)).toEqual([3, 4])
  expect(ctx.quat().w).toBe(1)
  ctx.renderer.domElement.parentElement?.remove()
})

test('registered groups are cleaned on unload and removed roots are caller-owned', () => {
  const ctx = makeContext()
  const group = ctx.add(new Three.Group())
  const geometry = new Three.BoxGeometry(), material = new Three.MeshBasicMaterial()
  group.add(new Three.Mesh(geometry, material))
  const dispose = vi.spyOn(geometry, 'dispose')
  ctx.add(group) // adding twice must not cause double disposal
  ctx.dispose(); ctx.dispose()
  expect(dispose).toHaveBeenCalledTimes(1)
  expect(ctx.scene.children).toHaveLength(0)
  ctx.renderer.domElement.parentElement?.remove()
})
