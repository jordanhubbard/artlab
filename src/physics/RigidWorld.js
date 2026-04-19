import { IPhysicsWorld } from './IPhysicsWorld.js'

/**
 * IPhysicsWorld implementation for rigid body physics via Rapier.js.
 *
 * Currently a stub — Rapier.js (WASM) requires async initialization and
 * must be installed first:
 *   npm install @dimforge/rapier3d-compat
 *
 * Call initRapier() after installation to activate the full simulation.
 */
export class RigidWorld extends IPhysicsWorld {
  constructor() {
    super()
    this._bodies = new Map()
    this._collisionCallbacks = []
    this._rapier = null  // loaded lazily via initRapier()
    this._world = null
    console.warn('[RigidWorld] Rapier.js not yet installed. Run: npm install @dimforge/rapier3d-compat')
    // When Rapier IS available, initialize: await RAPIER.init(); this._world = new RAPIER.World({x:0,y:-9.81,z:0})
  }

  addBody(id, desc) {
    this._bodies.set(id, {
      desc,
      position: desc.initialPosition ?? { x: 0, y: 0, z: 0 },
      rotation: desc.initialRotation ?? { x: 0, y: 0, z: 0, w: 1 },
    })
    console.warn(`[RigidWorld] addBody('${id}') — stub, Rapier not initialized`)
  }

  removeBody(id) {
    this._bodies.delete(id)
  }

  step(elapsed, dt) {
    // No-op until Rapier is initialized
    if (this._world) {
      this._world.step()
    }
  }

  getTransform(id) {
    const body = this._bodies.get(id)
    return body ? { position: body.position, rotation: body.rotation } : null
  }

  applyForce(id, force) {
    if (!this._world) return
    // When Rapier is initialized, retrieve the rigid body handle and apply force
  }

  onCollision(cb) {
    this._collisionCallbacks.push(cb)
  }

  dispose() {
    this._bodies.clear()
    this._collisionCallbacks = []
    this._world = null
  }

  /** Future: call this after npm install @dimforge/rapier3d-compat */
  async initRapier() {
    try {
      const RAPIER = await import('@dimforge/rapier3d-compat')
      await RAPIER.init()
      this._rapier = RAPIER
      this._world = new RAPIER.World({ x: 0, y: 0, z: 0 })
      console.info('[RigidWorld] Rapier.js initialized')
    } catch (e) {
      console.error('[RigidWorld] Failed to initialize Rapier:', e.message)
    }
  }
}
