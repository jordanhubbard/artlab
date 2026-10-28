// @vitest-environment jsdom
import { test, expect, vi } from 'vitest'
import * as Three from 'three'
import { PreviewPane } from '../ide/PreviewPane.js'
import { StandaloneRunner } from './StandaloneRunner.js'
import { makeContext } from '../../tests/context.js'

test('both hosts delegate their public API to the same context factory', () => {
  const bindings = {
    _scene: new Three.Scene(), _camera: new Three.PerspectiveCamera(),
    _renderer: { domElement: document.createElement('canvas') },
    _controls: { target: new Three.Vector3() }, _bloomPass: { strength: 0 },
  }
  const preview = PreviewPane.prototype._makeContext.call(bindings)
  const standalone = StandaloneRunner.prototype._makeCtx.call(bindings)
  expect(Object.keys(preview).sort()).toEqual(Object.keys(standalone).sort())
  for (const ctx of [preview, standalone]) {
    expect(ctx.mesh(ctx.box())).toBeInstanceOf(Three.Mesh)
    ctx.setBloom(0.5)
    expect(bindings._bloomPass.strength).toBe(0.5)
    ctx.setBloom()
    expect(bindings._bloomPass.strength).toBe(0)
    ctx.dispose()
  }
  const ctx = makeContext()
  expect(ctx.mesh(ctx.box())).toBeInstanceOf(Three.Mesh)
  expect(ctx.range(3)).toEqual([0, 1, 2])
  expect(ctx.range(3, 3)).toEqual([])
  expect(ctx.range(3, 5)).toEqual([3, 4])
  expect(ctx.quat().w).toBe(1)
  ctx.renderer.domElement.parentElement.remove()
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
  ctx.renderer.domElement.parentElement.remove()
})
