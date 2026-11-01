import * as Three from 'three'
import { SceneContext } from '../src/runtime/SceneContext.ts'
import type { RuntimeBindings } from '../src/runtime/contracts.ts'

// Real scene and public context; only the GPU-backed host objects are stubbed.
export function makeContext() {
  const container = document.createElement('div')
  const canvas = document.createElement('canvas')
  canvas.getBoundingClientRect = () => new DOMRect(0, 0, 800, 600)
  container.append(canvas)
  document.body.append(container)
  const camera = new Three.PerspectiveCamera(60, 4 / 3, 0.1, 10000)
  return new SceneContext({
    scene: new Three.Scene(), camera,
    // GPU-backed host objects are deliberately stubbed at the test boundary.
    renderer: { domElement: canvas } as RuntimeBindings['renderer'],
    controls: { target: new Three.Vector3(), enabled: true } as RuntimeBindings['controls'],
    labelRenderer: {} as RuntimeBindings['labelRenderer'], setHelp() {}, setBloom() {},
  })
}
