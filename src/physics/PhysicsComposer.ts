import type { IPhysicsWorld } from './IPhysicsWorld.ts'
/**
 * Runs multiple IPhysicsWorld instances together.
 * Bodies are looked up across all registered worlds in insertion order.
 */
export class PhysicsComposer {
  private _worlds: IPhysicsWorld[] = []
  constructor() {
    this._worlds = []
  }

  /** @param {import('./IPhysicsWorld.ts').IPhysicsWorld} world */
  add(world: IPhysicsWorld) {
    this._worlds.push(world)
    return this
  }

  /**
   * @param {number} elapsed - total elapsed time in seconds
   * @param {number} dt - delta time in seconds
   */
  step(elapsed: number, dt: number) {
    for (const w of this._worlds) w.step(elapsed, dt)
  }

  /**
   * @param {string} id
   * @returns {{ position: {x,y,z}, rotation: {x,y,z,w} } | null}
   */
  getTransform(id: string) {
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
