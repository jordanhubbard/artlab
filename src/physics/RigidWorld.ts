import { IPhysicsWorld } from './IPhysicsWorld.ts'
import type { RigidBodyDesc, Transform, Vector, CollisionCallback } from './IPhysicsWorld.ts'
import type { World } from '@dimforge/rapier3d-compat'

/**
 * IPhysicsWorld implementation for rigid body physics via Rapier.js.
 *
 * Currently a stub — Rapier.js (WASM) requires async initialization and
 * must be installed first:
 *   npm install @dimforge/rapier3d-compat
 *
 * Call initRapier() after installation to activate the full simulation.
 */
export class RigidWorld extends IPhysicsWorld<RigidBodyDesc> {
  private _bodies = new Map<string, Transform & { desc: RigidBodyDesc }>()
  private _collisionCallbacks: CollisionCallback[] = []
  private _rapier: typeof import('@dimforge/rapier3d-compat') | null = null
  private _world: World | null = null
  get bodies(): ReadonlyMap<string, Transform & { desc: RigidBodyDesc }> { return this._bodies }
  constructor() {
    super()
    this._bodies = new Map()
    this._collisionCallbacks = []
    this._rapier = null  // loaded lazily via initRapier()
    this._world = null
    console.warn('[RigidWorld] Rapier.js not yet installed. Run: npm install @dimforge/rapier3d-compat')
    // When Rapier IS available, initialize: await Rapier.init(); this._world = new Rapier.World({x:0,y:-9.81,z:0})
  }

  addBody(id: string, desc: RigidBodyDesc) {
    this._bodies.set(id, {
      desc,
      position: desc.initialPosition ?? { x: 0, y: 0, z: 0 },
      rotation: desc.initialRotation ?? { x: 0, y: 0, z: 0, w: 1 },
    })
    console.warn(`[RigidWorld] addBody('${id}') — stub, Rapier not initialized`)
  }

  removeBody(id: string) {
    this._bodies.delete(id)
  }

  step(elapsed: number, dt: number) {
    // No-op until Rapier is initialized
    if (this._world) {
      this._world.step()
    }
  }

  getTransform(id: string) {
    const body = this._bodies.get(id)
    return body ? { position: body.position, rotation: body.rotation } : null
  }

  applyForce(id: string, force: Vector) {
    if (!this._world) return
    // When Rapier is initialized, retrieve the rigid body handle and apply force
  }

  onCollision(cb: CollisionCallback) {
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
      const Rapier = await import('@dimforge/rapier3d-compat')
      await Rapier.init()
      this._rapier = Rapier
      this._world = new Rapier.World({ x: 0, y: 0, z: 0 })
      console.info('[RigidWorld] Rapier.js initialized')
    } catch (e) {
      console.error('[RigidWorld] Failed to initialize Rapier:', e instanceof Error ? e.message : String(e))
    }
  }
}
