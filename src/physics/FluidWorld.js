import { IPhysicsWorld } from './IPhysicsWorld.js'

// Default SPH constants
const SMOOTHING_RADIUS = 2.0
const REST_DENSITY = 1000
const GAS_CONSTANT = 200
const VISCOSITY = 0.1
const GRAVITY_VEC = { x: 0, y: -9.8, z: 0 }

// CFL-like dt cap for stability
const MAX_DT = 0.016

// ---------------------------------------------------------------------------
// SPH kernel functions (3D)
// ---------------------------------------------------------------------------

/**
 * W_poly6 kernel — used for density estimation.
 *   W(r,h) = (315 / 64π h^9) * (h²−r²)³  for r ≤ h
 */
function kernelPoly6(r2, h) {
  const h2 = h * h
  if (r2 > h2) return 0
  const diff = h2 - r2
  return (315 / (64 * Math.PI * Math.pow(h, 9))) * diff * diff * diff
}

/**
 * Gradient of W_spiky kernel — used for pressure forces.
 *   ∇W(r,h) = −(45 / π h^6) * (h−r)² * r̂   for r > 0 and r ≤ h
 * Returns the scalar factor; caller multiplies by the unit direction vector.
 */
function kernelSpikyGrad(r, h) {
  if (r <= 0 || r > h) return 0
  const diff = h - r
  return -(45 / (Math.PI * Math.pow(h, 6))) * diff * diff
}

/**
 * Laplacian of W_viscosity kernel — used for viscosity forces.
 *   ∇²W(r,h) = (45 / π h^6) * (h−r)   for r ≤ h
 */
function kernelViscosityLaplacian(r, h) {
  if (r > h) return 0
  return (45 / (Math.PI * Math.pow(h, 6))) * (h - r)
}

// ---------------------------------------------------------------------------

/**
 * CPU-based SPH fluid simulation implementing IPhysicsWorld.
 *
 * Suitable for ~500–2000 particles at interactive framerates using a simple
 * O(n²) neighbour search.
 *
 * Each body (emitter) is a self-contained fluid blob; inter-body SPH
 * interactions are intentionally omitted for simplicity.
 */
export class FluidWorld extends IPhysicsWorld {
  constructor(options = {}) {
    super()
    this._smoothingRadius = options.smoothingRadius ?? SMOOTHING_RADIUS
    this._restDensity = options.restDensity ?? REST_DENSITY
    this._gasConstant = options.gasConstant ?? GAS_CONSTANT
    this._viscosity = options.viscosity ?? VISCOSITY
    this._gravity = options.gravity ?? { ...GRAVITY_VEC }
    /** @type {Map<string, {particles: Array, desc: object, externalForce: {x,y,z}}>} */
    this._emitters = new Map()
  }

  // -------------------------------------------------------------------------
  // IPhysicsWorld interface
  // -------------------------------------------------------------------------

  /**
   * Add a fluid body (emitter).
   *
   * @param {string} id
   * @param {object} desc
   * @param {{ x,y,z }} [desc.position]   - spawn centre, default origin
   * @param {number}    [desc.count]       - particle count, default 100
   * @param {number}    [desc.radius]      - spawn sphere radius, default 0.5
   * @param {{ x,y,z }} [desc.velocity]   - initial velocity for all particles
   * @param {{ min:{x,y,z}, max:{x,y,z} }} [desc.bounds] - AABB boundary
   */
  addBody(id, desc) {
    const position = desc.position ?? { x: 0, y: 0, z: 0 }
    const count = desc.count ?? 100
    const spawnRadius = desc.radius ?? 0.5
    const vel = desc.velocity ?? { x: 0, y: 0, z: 0 }

    const particles = []
    for (let i = 0; i < count; i++) {
      // Distribute particles in a sphere via rejection sampling
      let px, py, pz
      do {
        px = (Math.random() * 2 - 1) * spawnRadius
        py = (Math.random() * 2 - 1) * spawnRadius
        pz = (Math.random() * 2 - 1) * spawnRadius
      } while (px * px + py * py + pz * pz > spawnRadius * spawnRadius)

      particles.push({
        x: position.x + px,
        y: position.y + py,
        z: position.z + pz,
        vx: vel.x,
        vy: vel.y,
        vz: vel.z,
        density: 0,
        pressure: 0,
        // force accumulators (reset each step)
        fx: 0,
        fy: 0,
        fz: 0,
        // mass is uniform; stored per-particle for extensibility
        mass: 1.0,
      })
    }

    this._emitters.set(id, {
      desc,
      particles,
      externalForce: { x: 0, y: 0, z: 0 },
    })
  }

  removeBody(id) {
    this._emitters.delete(id)
  }

  /**
   * Advance the simulation.
   * @param {number} elapsed - total elapsed time (unused by SPH, available for hooks)
   * @param {number} dt - delta time in seconds (clamped to MAX_DT for stability)
   */
  step(elapsed, dt) {
    const safeDt = Math.min(dt, MAX_DT)
    for (const emitter of this._emitters.values()) {
      this._stepEmitter(emitter, safeDt)
    }
  }

  /**
   * Return the centre-of-mass position of the fluid body.
   * @param {string} id
   * @returns {{ position: {x,y,z}, rotation: {x,y,z,w} } | null}
   */
  getTransform(id) {
    const em = this._emitters.get(id)
    if (!em || em.particles.length === 0) return null
    const pos = em.particles.reduce(
      (a, p) => ({ x: a.x + p.x, y: a.y + p.y, z: a.z + p.z }),
      { x: 0, y: 0, z: 0 }
    )
    const n = em.particles.length
    return {
      position: { x: pos.x / n, y: pos.y / n, z: pos.z / n },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
    }
  }

  /**
   * Return the raw particle array for a body (used by renderers).
   * Each particle has { x, y, z, vx, vy, vz, density, pressure, mass }.
   * @param {string} id
   * @returns {Array}
   */
  getParticles(id) {
    return this._emitters.get(id)?.particles ?? []
  }

  /**
   * Accumulate an external impulse/force to be applied to all particles
   * during the next step.  Resets after each step.
   * @param {string} id
   * @param {{ x: number, y: number, z: number }} force
   */
  applyForce(id, force) {
    const em = this._emitters.get(id)
    if (!em) return
    em.externalForce.x += force.x
    em.externalForce.y += force.y
    em.externalForce.z += force.z
  }

  /** Not used for fluid simulation. */
  onCollision(cb) {}

  dispose() {
    this._emitters.clear()
  }

  // -------------------------------------------------------------------------
  // Internal SPH pipeline
  // -------------------------------------------------------------------------

  _stepEmitter(emitter, dt) {
    const { particles, desc, externalForce } = emitter
    const n = particles.length
    if (n === 0) return

    const h = this._smoothingRadius
    const h2 = h * h

    // ------------------------------------------------------------------
    // 1. Compute density and pressure for each particle
    // ------------------------------------------------------------------
    for (let i = 0; i < n; i++) {
      const pi = particles[i]
      let density = 0

      for (let j = 0; j < n; j++) {
        const pj = particles[j]
        const dx = pi.x - pj.x
        const dy = pi.y - pj.y
        const dz = pi.z - pj.z
        const r2 = dx * dx + dy * dy + dz * dz
        density += pj.mass * kernelPoly6(r2, h)
      }

      pi.density = density
      // Equation of state: p = k (ρ − ρ₀)   (Desbrun 1996 / Müller 2003)
      pi.pressure = this._gasConstant * (density - this._restDensity)
    }

    // ------------------------------------------------------------------
    // 2. Compute forces: pressure + viscosity + gravity + external
    // ------------------------------------------------------------------
    for (let i = 0; i < n; i++) {
      const pi = particles[i]
      let fx = 0, fy = 0, fz = 0

      for (let j = 0; j < n; j++) {
        if (i === j) continue
        const pj = particles[j]
        const dx = pi.x - pj.x
        const dy = pi.y - pj.y
        const dz = pi.z - pj.z
        const r2 = dx * dx + dy * dy + dz * dz
        if (r2 >= h2) continue

        const r = Math.sqrt(r2)

        // --- Pressure force (W_spiky gradient, symmetric average) ---
        if (r > 1e-6) {
          const gradW = kernelSpikyGrad(r, h)
          // Symmetric pressure term: (p_i + p_j) / 2
          const pressureTerm = pj.mass * (pi.pressure + pj.pressure) / (2 * pj.density + 1e-6)
          // gradW is negative scalar; direction from j→i is (dx,dy,dz)/r
          const factor = pressureTerm * gradW / r
          fx += factor * dx
          fy += factor * dy
          fz += factor * dz
        }

        // --- Viscosity force (W_viscosity Laplacian) ---
        const lapW = kernelViscosityLaplacian(r, h)
        const viscFactor = this._viscosity * pj.mass * lapW / (pj.density + 1e-6)
        fx += viscFactor * (pj.vx - pi.vx)
        fy += viscFactor * (pj.vy - pi.vy)
        fz += viscFactor * (pj.vz - pi.vz)
      }

      // --- Gravity ---
      const rho = pi.density + 1e-6
      fx += this._gravity.x * rho
      fy += this._gravity.y * rho
      fz += this._gravity.z * rho

      // --- External per-step force (applied uniformly to all particles) ---
      fx += externalForce.x
      fy += externalForce.y
      fz += externalForce.z

      pi.fx = fx
      pi.fy = fy
      pi.fz = fz
    }

    // Reset external force accumulator after consuming it
    externalForce.x = 0
    externalForce.y = 0
    externalForce.z = 0

    // ------------------------------------------------------------------
    // 3. Integrate: semi-implicit Euler
    //    v(t+dt) = v(t) + (F/ρ) * dt
    //    x(t+dt) = x(t) + v(t+dt) * dt
    // ------------------------------------------------------------------
    for (let i = 0; i < n; i++) {
      const p = particles[i]
      const rho = p.density + 1e-6
      p.vx += (p.fx / rho) * dt
      p.vy += (p.fy / rho) * dt
      p.vz += (p.fz / rho) * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.z += p.vz * dt
    }

    // ------------------------------------------------------------------
    // 4. Boundary collision (AABB, simple velocity reflection with damping)
    // ------------------------------------------------------------------
    const bounds = desc.bounds ?? {
      min: { x: -50, y: -50, z: -50 },
      max: { x:  50, y:  50, z:  50 },
    }
    const DAMPING = 0.3
    for (let i = 0; i < n; i++) {
      const p = particles[i]

      if (p.x < bounds.min.x) { p.x = bounds.min.x; p.vx = Math.abs(p.vx) * DAMPING }
      if (p.x > bounds.max.x) { p.x = bounds.max.x; p.vx = -Math.abs(p.vx) * DAMPING }

      if (p.y < bounds.min.y) { p.y = bounds.min.y; p.vy = Math.abs(p.vy) * DAMPING }
      if (p.y > bounds.max.y) { p.y = bounds.max.y; p.vy = -Math.abs(p.vy) * DAMPING }

      if (p.z < bounds.min.z) { p.z = bounds.min.z; p.vz = Math.abs(p.vz) * DAMPING }
      if (p.z > bounds.max.z) { p.z = bounds.max.z; p.vz = -Math.abs(p.vz) * DAMPING }
    }
  }
}
