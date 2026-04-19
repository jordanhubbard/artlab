import { IPhysicsWorld } from './IPhysicsWorld.js'

/**
 * IPhysicsWorld implementation for CPU-simulated particle systems.
 */
export class ParticleWorld extends IPhysicsWorld {
  constructor() {
    super()
    this._emitters = new Map()   // id → EmitterState
  }

  /**
   * Add a particle emitter.
   * @param {string} id
   * @param {ParticleEmitterDesc} desc - must have type === 'particle'
   */
  addBody(id, desc) {
    if (desc.type !== 'particle') {
      throw new Error(`ParticleWorld.addBody: expected type 'particle', got '${desc.type}'`)
    }
    this._emitters.set(id, {
      desc,
      particles: [],
      accumulator: 0,
      time: 0,
    })
  }

  removeBody(id) {
    this._emitters.delete(id)
  }

  step(elapsed, dt) {
    for (const [id, emitter] of this._emitters) {
      this._stepEmitter(emitter, elapsed, dt)
    }
  }

  _stepEmitter(emitter, elapsed, dt) {
    const { desc } = emitter
    const rate = desc.rate ?? 10
    const lifetime = desc.lifetime ?? 2.0
    const speed = desc.speed ?? 5.0
    const gravity = desc.gravity ?? 0

    // Spawn new particles
    emitter.accumulator += rate * dt
    while (emitter.accumulator >= 1) {
      emitter.accumulator -= 1
      emitter.particles.push({
        position: { x: 0, y: 0, z: 0 },
        velocity: this._randomVelocity(desc, speed),
        age: 0,
        lifetime: lifetime * (0.8 + Math.random() * 0.4),
      })
    }

    // Update existing particles, culling expired ones
    emitter.particles = emitter.particles.filter(p => {
      p.age += dt
      p.position.x += p.velocity.x * dt
      p.position.y += p.velocity.y * dt - 0.5 * gravity * dt * dt
      p.position.z += p.velocity.z * dt
      p.velocity.y -= gravity * dt
      return p.age < p.lifetime
    })
  }

  _randomVelocity(desc, speed) {
    const spread = (desc.spread ?? 30) * Math.PI / 180
    const theta = Math.random() * Math.PI * 2
    const phi = Math.random() * spread
    return {
      x: Math.sin(phi) * Math.cos(theta) * speed,
      y: Math.cos(phi) * speed,
      z: Math.sin(phi) * Math.sin(theta) * speed,
    }
  }

  /** Get all live particles for a given emitter (for rendering). */
  getParticles(id) {
    return this._emitters.get(id)?.particles ?? []
  }

  /**
   * Emitters don't have a single transform; returns the world origin.
   * @param {string} id
   * @returns {{ position: {x,y,z}, rotation: {x,y,z,w} }}
   */
  getTransform(id) {
    return { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } }
  }

  dispose() {
    this._emitters.clear()
  }
}
