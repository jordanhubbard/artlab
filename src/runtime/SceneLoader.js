/**
 * SceneLoader — connects the DSL package system to the Three.js scene graph.
 *
 * Loads an Artlab package (zip URL, ArrayBuffer, Blob, or PackageReader),
 * transpiles its DSL entry point, dynamic-imports the resulting blob URL,
 * and drives the module's setup(ctx) / update(ctx, dt) / teardown(ctx)
 * lifecycle from the animation loop.
 *
 * Usage:
 *   const loader = new SceneLoader(renderer, scene, camera)
 *   await loader.load('https://example.com/my-package.zip')
 *
 *   // In your animation loop:
 *   loader.tick(dt)
 *
 *   // To swap packages:
 *   loader.unload()
 *   await loader.load(nextSource)
 */

import * as THREE from 'three'
import { PackageLoader } from '../packages/PackageLoader.js'

// ---------------------------------------------------------------------------
// Context factory
// ---------------------------------------------------------------------------

/**
 * Build the context object passed to every DSL module's setup() / update().
 *
 * The context:
 *  - Provides direct access to scene, camera, renderer, and the THREE namespace.
 *  - Wraps scene.add / scene.remove so SceneLoader can track and clean up
 *    objects added by the module on unload.
 *  - Exposes a lightweight in-context event emitter for inter-module messaging
 *    that is scoped to this load session (all listeners are dropped on unload).
 *
 * @param {THREE.Scene}          scene
 * @param {THREE.Camera}         camera
 * @param {THREE.WebGLRenderer}  renderer
 * @returns {object} context
 */
function makeContext(scene, camera, renderer) {
  const added = []

  /** @type {Map<string, Set<Function>>} */
  const _listeners = new Map()

  return {
    // Core Three.js objects
    scene,
    camera,
    renderer,
    THREE,

    /**
     * Add a Three.js object to the scene and track it for cleanup.
     * @param {THREE.Object3D} obj
     * @returns {THREE.Object3D} the same object (for chaining)
     */
    add(obj) {
      scene.add(obj)
      added.push(obj)
      return obj
    },

    /**
     * Remove a Three.js object from the scene.
     * Does NOT automatically clean up geometry/material — call obj.dispose()
     * yourself if you need to free GPU memory.
     * @param {THREE.Object3D} obj
     */
    remove(obj) {
      scene.remove(obj)
      const idx = added.indexOf(obj)
      if (idx >= 0) added.splice(idx, 1)
    },

    // ------------------------------------------------------------------
    // Simple in-context event emitter
    // Useful for DSL modules communicating with sibling modules or the host.
    // All listeners registered here are scoped to this load session.
    // ------------------------------------------------------------------

    /**
     * Subscribe to a context event.
     * @param {string}   event
     * @param {Function} cb
     * @returns {Function} unsubscribe function
     */
    on(event, cb) {
      if (!_listeners.has(event)) _listeners.set(event, new Set())
      _listeners.get(event).add(cb)
      return () => this.off(event, cb)
    },

    /**
     * Unsubscribe from a context event.
     * @param {string}   event
     * @param {Function} cb
     */
    off(event, cb) {
      const set = _listeners.get(event)
      if (!set) return
      set.delete(cb)
      if (set.size === 0) _listeners.delete(event)
    },

    /**
     * Emit a context event to all registered listeners.
     * @param {string} event
     * @param {*}      [data]
     */
    emit(event, data) {
      const set = _listeners.get(event)
      if (!set || set.size === 0) return
      for (const cb of [...set]) {
        try {
          cb(data)
        } catch (err) {
          console.error(`[SceneLoader ctx] Error in listener for "${event}":`, err)
        }
      }
    },

    // Private — accessed by SceneLoader for cleanup
    _added: added,
    _listeners,
  }
}

// ---------------------------------------------------------------------------
// SceneLoader
// ---------------------------------------------------------------------------

export class SceneLoader {
  /**
   * @param {THREE.WebGLRenderer} renderer
   * @param {THREE.Scene}         scene
   * @param {THREE.Camera}        camera
   */
  constructor(renderer, scene, camera) {
    this._renderer = renderer
    this._scene    = scene
    this._camera   = camera

    /** @type {object|null} The currently loaded DSL module */
    this._currentModule = null

    /** @type {object|null} Context passed to setup/update */
    this._ctx = null

    /** @type {import('../packages/PackageLoader.js').ArtlabManifest|null} */
    this._manifest = null
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Load a package and set up its scene.
   *
   * @param {string|ArrayBuffer|Blob|import('../packages/PackageReader.js').PackageReader} source
   *   - A URL string to a .zip file
   *   - An ArrayBuffer / Blob containing zip data
   *   - An already-constructed PackageReader instance
   * @param {object}  [options]           Forwarded to PackageLoader.load()
   * @param {boolean} [options.devMode]   Use DevResolver for URL-based dependencies
   * @returns {Promise<{ manifest: object, module: object }>}
   */
  async load(source, options = {}) {
    // Unload any currently running package first
    this.unload()

    const loader = new PackageLoader()
    const { manifest, module: mod } = await loader.load(source, options)

    this._manifest      = manifest
    this._currentModule = mod
    this._ctx           = makeContext(this._scene, this._camera, this._renderer)

    this._callSetup(mod)

    return { manifest, module: mod }
  }

  /**
   * Unload the current package.
   *
   * - Calls `teardown(ctx)` on the module if it exports one.
   * - Removes every Three.js object that was added via ctx.add().
   * - Drops all context event listeners.
   * - Resets internal state so the loader is ready for the next load().
   */
  unload() {
    if (!this._currentModule) return

    const mod = this._currentModule
    const ctx = this._ctx

    // Give the module a chance to clean up its own state
    if (typeof mod.teardown === 'function') {
      try {
        mod.teardown(ctx)
      } catch (err) {
        console.error('[SceneLoader] Error in module teardown():', err)
      }
    }

    // Remove every object that was added through ctx.add()
    if (ctx?._added) {
      for (const obj of [...ctx._added]) {
        this._scene.remove(obj)
      }
      ctx._added.length = 0
    }

    // Drop all context event listeners
    ctx?._listeners?.clear()

    this._currentModule = null
    this._ctx           = null
    this._manifest      = null
  }

  /**
   * Advance the loaded module by one frame.
   * Call this from your animation loop.
   *
   * @param {number} dt  Delta-time in seconds since the last frame
   */
  tick(dt) {
    if (this._currentModule?.update) {
      try {
        this._currentModule.update(this._ctx, dt)
      } catch (err) {
        console.error('[SceneLoader] Error in module update():', err)
      }
    }
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  /**
   * Call the DSL module's exported `setup(ctx)` function, if present.
   *
   * @param {object} mod  The dynamic-imported module object
   */
  _callSetup(mod) {
    if (typeof mod.setup === 'function') {
      try {
        mod.setup(this._ctx)
      } catch (err) {
        throw new Error(`[SceneLoader] Error in module setup(): ${err.message}`)
      }
    }
  }
}
