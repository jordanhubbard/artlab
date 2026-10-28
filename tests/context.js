import * as Three from 'three'
import { SceneContext } from '../src/runtime/SceneContext.js'

// Real scene and public context; only the GPU-backed host objects are stubbed.
export function makeContext() {
  const container = document.createElement('div')
  const canvas = document.createElement('canvas')
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 })
  container.append(canvas)
  document.body.append(container)
  const camera = new Three.PerspectiveCamera(60, 4 / 3, 0.1, 10000)
  return new SceneContext({
    scene: new Three.Scene(), camera,
    renderer: { domElement: canvas },
    controls: { target: new Three.Vector3(), enabled: true },
    labelRenderer: {}, setHelp() {}, setBloom() {},
  })
}
