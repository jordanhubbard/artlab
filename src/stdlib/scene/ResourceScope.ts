import type * as Three from 'three'

type OwnedResource = Three.Object3D | { dispose(): unknown }
type SceneHost = { add(object: Three.Object3D): unknown; remove(object: Three.Object3D): unknown }
type RenderObject = Three.Object3D & {
  geometry?: Three.BufferGeometry
  material?: Three.Material | Three.Material[]
  element?: HTMLElement
  shadow?: { dispose(): void }
  dispose?(): void
}
function isTexture(value: unknown): value is Three.Texture {
  return typeof value === 'object' && value !== null && 'isTexture' in value && value.isTexture === true
}

/** Own a scene's objects, resources, listeners, and temporary settings. */
export class ResourceScope {
  disposed = false
  private _cleanup: (() => unknown)[] = []
  private _owned = new Set<OwnedResource>()
  private _released = new WeakSet<object>()
  private _completion?: Promise<void>
  constructor() {
    this.disposed = false
    this._cleanup = []
    this._owned = new Set()
    this._released = new WeakSet()
  }

  /** @param {() => unknown} cleanup */
  defer<T>(cleanup: () => T): (() => T) | T {
    if (this.disposed) return cleanup()
    this._cleanup.push(cleanup)
    return cleanup
  }

  /** @template {import('three').Object3D | { dispose(): unknown }} T @param {T} resource @returns {T} */
  own<T extends OwnedResource>(resource: T): T {
    if (resource && !this._owned.has(resource)) {
      this._owned.add(resource)
      this.defer(() => this._release(resource))
    }
    return resource
  }

  add<T extends Three.Object3D>(ctx: SceneHost, object: T): T {
    ctx.add(object)
    this.own(object)
    this.defer(() => ctx.remove(object))
    return object
  }

  /** @param {EventTarget} target @param {string} type @param {EventListener} handler @param {AddEventListenerOptions|boolean} [options] */
  listen(target: EventTarget, type: string, handler: EventListenerOrEventListenerObject, options?: AddEventListenerOptions | boolean) {
    target.addEventListener(type, handler, options)
    this.defer(() => target.removeEventListener(type, handler, options))
    return handler
  }

  append<T extends Element>(parent: Node, element: T): T {
    parent.appendChild(element)
    this.defer(() => element.remove())
    return element
  }

  set<T, K extends keyof T>(target: T, key: K, value: T[K]): T[K] {
    const previous = target[key]
    target[key] = value
    this.defer(() => { target[key] = previous })
    return value
  }

  private _release(resource: unknown): unknown {
    if (!resource || typeof resource !== 'object' || this._released.has(resource)) return
    this._released.add(resource)
    if ('isObject3D' in resource && resource.isObject3D === true) {
      const root = resource as RenderObject
      root.traverse((object: RenderObject) => {
        if (object !== resource && this._released.has(object)) return
        this._released.add(object)
        this._release(object.geometry)
        for (const material of [object.material].flat()) this._release(material)
        object.element?.remove()
        object.shadow?.dispose()
        object.dispose?.()
      })
      root.removeFromParent()
    } else {
      if ('isMaterial' in resource && resource.isMaterial === true) {
        for (const value of Object.values(resource)) {
          if (isTexture(value)) this._release(value)
        }
        const uniforms = 'uniforms' in resource ? resource.uniforms : undefined
        for (const uniform of Object.values((uniforms ?? {}) as Record<string, Three.IUniform<unknown>>)) {
          for (const value of [uniform.value].flat()) {
            if (isTexture(value)) this._release(value)
          }
        }
      }
      if ('dispose' in resource && typeof resource.dispose === 'function') return resource.dispose()
    }
  }

  /** @returns {Promise<void>} */
  dispose() {
    if (this.disposed) return this._completion ?? Promise.resolve()
    this.disposed = true
    const pending: unknown[] = []
    const errors: unknown[] = []
    for (const cleanup of this._cleanup.reverse()) {
      try { pending.push(cleanup()) } catch (error) { errors.push(error) }
    }
    this._cleanup.length = 0
    this._owned.clear()
    this._completion = Promise.allSettled(pending).then(results => {
      errors.push(...results.filter(r => r.status === 'rejected').map(r => r.reason))
      if (errors.length) throw new AggregateError(errors, 'Scene cleanup failed')
    })
    return this._completion
  }
}
