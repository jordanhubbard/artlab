// @vitest-environment jsdom
import { it, expect, vi } from 'vitest'
import * as Three from 'three'
import { SceneContext } from '../../runtime/SceneContext.js'
import { StandaloneRunner } from '../../runtime/StandaloneRunner.js'
import { PreviewPane } from '../PreviewPane.js'

it('provides identical modeling helpers in the preview and standalone runner', () => {
  const runner = {
    _scene: new Three.Scene(), _camera: new Three.PerspectiveCamera(),
    _renderer: { domElement: document.createElement('canvas') }, _controls: {},
    _bloomPass: {}, _assetFiles: new Map(), _textureBlobUrls: [],
  }
  const preview = PreviewPane.prototype._makeContext.call(runner)
  const standalone = StandaloneRunner.prototype._makeCtx.call(runner)
  for (const name of ['sphere', 'box', 'mesh', 'point', 'noise2', 'vec3', 'range', 'loadTexture']) {
    expect(typeof preview[name]).toBe('function')
    expect(typeof standalone[name]).toBe('function')
  }
  expect(standalone.box().isBufferGeometry).toBe(true)
})

it('allows destructured add/remove and releases late additions to a disposed context', async () => {
  const scene = new Three.Scene()
  const ctx = new SceneContext({ scene })
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
