import * as Three from 'three'
import * as geometry from '../stdlib/geometry.js'
import * as lights from '../stdlib/lights.js'
import * as math from '../stdlib/math.js'
import { ResourceScope } from '../stdlib/scene/ResourceScope.js'

/** The shared public context for editor previews and standalone compositions. */
export class SceneContext {
  #resources = new ResourceScope()
  constructor({ scene, camera, renderer, controls, labelRenderer, setBloom, setHelp, loadTexture }) {
    Object.assign(this, geometry, lights, math, { Three, scene, camera, renderer, controls, labelRenderer })
    this.elapsed = 0
    this._added = []
    this._userVars = {}
    this.setBloom = setBloom ?? (() => {})
    this.setHelp = setHelp ?? (() => {})
    this.loadTexture = loadTexture ?? (path => new Three.TextureLoader().load(path))
    // Arrow functions preserve the public API's existing destructuring convention.
    this.add = object => {
      if (this.#resources.disposed) { this.#resources.own(object); return object }
      scene.add(object)
      if (!this._added.includes(object)) this._added.push(object)
      return object
    }
    this.remove = object => {
      scene.remove(object)
      const index = this._added.indexOf(object)
      if (index >= 0) this._added.splice(index, 1)
    }
    this.vec2 = (x, y) => new Three.Vector2(x, y)
    this.vec3 = (x, y, z) => new Three.Vector3(x, y, z)
    this.vec4 = (x, y, z, w) => new Three.Vector4(x, y, z, w)
    this.color = (...args) => new Three.Color(...args)
    this.quat = (x, y, z, w) => new Three.Quaternion(x, y, z, w)
    this.range = (a, b) => {
      const start = b === undefined ? 0 : a
      const end = b === undefined ? a : b
      return Array.from({ length: Math.max(0, end - start) }, (_, i) => start + i)
    }
  }

  dispose() {
    for (const object of this._added) this.#resources.own(object)
    this._added.length = 0
    return this.#resources.dispose()
  }
}
