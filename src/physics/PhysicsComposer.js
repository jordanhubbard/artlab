/**
 * Runs multiple IPhysicsWorld instances together.
 * Bodies are looked up across all registered worlds in insertion order.
 */
export class PhysicsComposer {
  constructor() {
    this._worlds = []
  }

  /** @param {import('./IPhysicsWorld.js').IPhysicsWorld} world */
  add(world) {
    this._worlds.push(world)
    return this
  }

  /**
   * @param {number} elapsed - total elapsed time in seconds
   * @param {number} dt - delta time in seconds
   */
  step(elapsed, dt) {
    for (const w of this._worlds) w.step(elapsed, dt)
  }

  /**
   * @param {string} id
   * @returns {{ position: {x,y,z}, rotation: {x,y,z,w} } | null}
   */
  getTransform(id) {
    for (const w of this._worlds) {
      const t = w.getTransform(id)
      if (t) return t
    }
    return null
  }

  dispose() {
    for (const w of this._worlds) w.dispose()
  }
}
