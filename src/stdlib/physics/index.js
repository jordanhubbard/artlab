/**
 * artlab/physics
 *
 * Unified entry point for the Artlab physics DSL layer.
 * Re-exports everything from the orbital helpers and the engine bindings so
 * DSL programs can import from a single path:
 *
 *   import { orbit, solarOrbit, createPhysics, attachOrbit, attachRigid,
 *            createEmitter, setGravity, AU } from 'artlab/physics'
 *
 * @module artlab/physics
 */

export * from './orbital.js'
export * from './bindings.js'
