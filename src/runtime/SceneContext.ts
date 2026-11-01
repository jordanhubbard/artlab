// @ts-check
import * as Three from 'three'
import * as geometry from '../stdlib/geometry.ts'
import * as lights from '../stdlib/lights.ts'
import * as math from '../stdlib/math.ts'
import { ResourceScope } from '../stdlib/scene/ResourceScope.ts'
import type { RuntimeBindings } from './contracts'

type StandardLibrary = Omit<typeof geometry & typeof lights & typeof math, 'add'>
const StandardLibraryContext = class {
  constructor() { Object.assign(this, geometry, lights, math) }
} as new () => StandardLibrary

/** The shared public context for editor previews and standalone compositions. */
export class SceneContext extends StandardLibraryContext {
  readonly Three = Three
  readonly scene: RuntimeBindings['scene']
  readonly camera: RuntimeBindings['camera']
  readonly renderer: RuntimeBindings['renderer']
  readonly controls: RuntimeBindings['controls']
  readonly labelRenderer: RuntimeBindings['labelRenderer']
  readonly setBloom: RuntimeBindings['setBloom']
  readonly setHelp: RuntimeBindings['setHelp']
  readonly loadTexture: NonNullable<RuntimeBindings['loadTexture']>
  elapsed = 0
  _added: Three.Object3D[] = []
  _userVars: Record<string, unknown> = {}
  readonly add: <T extends Three.Object3D>(object: T) => T
  readonly remove: (object: Three.Object3D) => void
  readonly vec2: (x?: number, y?: number) => Three.Vector2
  readonly vec3: (x?: number, y?: number, z?: number) => Three.Vector3
  readonly vec4: (x?: number, y?: number, z?: number, w?: number) => Three.Vector4
  readonly color: (r?: Three.ColorRepresentation, g?: number, b?: number) => Three.Color
  readonly quat: (x?: number, y?: number, z?: number, w?: number) => Three.Quaternion
  readonly range: (a: number, b?: number) => number[]
  #resources = new ResourceScope()
  get scope() { return this.#resources }

  /** @param {import('./contracts').RuntimeBindings} bindings */
  constructor({ scene, camera, renderer, controls, labelRenderer, setBloom, setHelp, loadTexture }: RuntimeBindings) {
    super()
    this.Three = Three
    this.scene = scene
    this.camera = camera
    this.renderer = renderer
    this.controls = controls
    this.labelRenderer = labelRenderer
    this.elapsed = 0
    /** @type {Three.Object3D[]} */
    this._added = []
    this._userVars = {}
    this.setBloom = setBloom ?? (() => {})
    this.setHelp = setHelp ?? (() => {})
    this.loadTexture = loadTexture ?? (path => new Three.TextureLoader().load(path))
    // Arrow functions preserve the public API's existing destructuring convention.
    this.add = <T extends Three.Object3D>(object: T): T => {
      if (this.#resources.disposed) { this.#resources.own(object); return object }
      scene.add(object)
      if (!this._added.includes(object)) this._added.push(object)
      return object
    }
    this.remove = /** @param {Three.Object3D} object */ object => {
      object.removeFromParent()
      const index = this._added.indexOf(object)
      if (index >= 0) this._added.splice(index, 1)
    }
    this.vec2 = (x = 0, y = 0) => new Three.Vector2(x, y)
    this.vec3 = (x = 0, y = 0, z = 0) => new Three.Vector3(x, y, z)
    this.vec4 = (x = 0, y = 0, z = 0, w = 1) => new Three.Vector4(x, y, z, w)
    this.color = /** @param {Three.ColorRepresentation} [r] @param {number} [g] @param {number} [b] */ (r, g, b) => g === undefined || b === undefined ? new Three.Color(r) : new Three.Color(Number(r), g, b)
    this.quat = (x = 0, y = 0, z = 0, w = 1) => new Three.Quaternion(x, y, z, w)
    this.range = /** @param {number} a @param {number} [b] */ (a, b) => {
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
