/** Own a scene's objects, resources, listeners, and temporary settings. */
export class ResourceScope {
  constructor() {
    this.disposed = false
    this._cleanup = []
    this._owned = new Set()
    this._released = new WeakSet()
  }

  defer(cleanup) {
    if (this.disposed) return cleanup()
    this._cleanup.push(cleanup)
    return cleanup
  }

  own(resource) {
    if (resource && !this._owned.has(resource)) {
      this._owned.add(resource)
      this.defer(() => this._release(resource))
    }
    return resource
  }

  add(ctx, object) {
    ctx.add(object)
    this.own(object)
    this.defer(() => ctx.remove(object))
    return object
  }

  listen(target, type, handler, options) {
    target.addEventListener(type, handler, options)
    this.defer(() => target.removeEventListener(type, handler, options))
    return handler
  }

  append(parent, element) {
    parent.appendChild(element)
    this.defer(() => element.remove())
    return element
  }

  set(target, key, value) {
    const previous = target[key]
    target[key] = value
    this.defer(() => { target[key] = previous })
    return value
  }

  _release(resource) {
    if (!resource || this._released.has(resource)) return
    this._released.add(resource)
    if (resource.isObject3D) {
      resource.traverse(object => {
        if (object !== resource && this._released.has(object)) return
        this._released.add(object)
        this._release(object.geometry)
        for (const material of [object.material].flat()) this._release(material)
        object.element?.remove()
        object.shadow?.dispose()
        object.dispose?.()
      })
      resource.removeFromParent()
    } else {
      if (resource.isMaterial) {
        for (const value of Object.values(resource)) {
          if (value?.isTexture) this._release(value)
        }
        for (const uniform of Object.values(resource.uniforms ?? {})) {
          for (const value of [uniform.value].flat()) {
            if (value?.isTexture) this._release(value)
          }
        }
      }
      return resource.dispose?.()
    }
  }

  dispose() {
    if (this.disposed) return this._completion
    this.disposed = true
    const pending = []
    const errors = []
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
