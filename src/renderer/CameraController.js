import { CameraSystem } from '../camera/CameraSystem.js'

/**
 * CameraController wraps CameraSystem behind a cleaner configuration-driven
 * interface. It owns the CameraSystem instance and exposes the camera /
 * controls objects for consumers that need direct access.
 */
export class CameraController {
  /**
   * @param {import('./IRenderer.js').IRenderer} renderer
   * @param {Three.Scene} scene
   */
  constructor(renderer, scene) {
    this._system = new CameraSystem(renderer, scene)
  }

  // ── Configuration ────────────────────────────────────────────────────────────

  /**
   * Configure the camera and controls.
   *
   * @param {Object}   desc
   * @param {string}   [desc.type]       - camera projection type: 'perspective' (default) | 'orthographic'
   * @param {number}   [desc.fov]        - field of view in degrees (perspective only)
   * @param {number[]} [desc.position]   - [x, y, z] initial position
   * @param {number[]} [desc.target]     - [x, y, z] initial look-at target
   * @param {number}   [desc.near]       - near clip plane
   * @param {number}   [desc.far]        - far clip plane
   * @param {number}   [desc.minDistance] - orbit controls min zoom distance
   * @param {number}   [desc.maxDistance] - orbit controls max zoom distance
   */
  configure(desc) {
    const cam      = this._system.camera
    const controls = this._system.controls

    if (!desc) return

    if (desc.fov !== undefined) {
      cam.fov = desc.fov
      cam.updateProjectionMatrix()
    }

    if (desc.near !== undefined || desc.far !== undefined) {
      if (desc.near !== undefined) cam.near = desc.near
      if (desc.far  !== undefined) cam.far  = desc.far
      cam.updateProjectionMatrix()
    }

    if (desc.position) {
      const [x, y, z] = desc.position
      cam.position.set(x, y, z)
    }

    if (desc.target) {
      const [x, y, z] = desc.target
      controls.target.set(x, y, z)
      cam.lookAt(x, y, z)
    }

    if (desc.minDistance !== undefined) controls.minDistance = desc.minDistance
    if (desc.maxDistance !== undefined) controls.maxDistance = desc.maxDistance
  }

  // ── Delegated CameraSystem operations ────────────────────────────────────────

  /**
   * Begin the cinematic intro journey through the solar system.
   * @param {Object} planets  - map of planet name → planet object (from main.js)
   */
  startJourney(planets) {
    this._system.startJourney(planets)
  }

  /**
   * Fly the camera to focus on a specific planet.
   * @param {Object} planet  - planet object with a .mesh property
   * @param {string} name    - planet key (used for label / data lookup)
   */
  focusPlanet(planet, name) {
    this._system.focusPlanet(planet, name)
  }

  /**
   * Call on window resize to keep the camera aspect ratio correct.
   */
  onResize() {
    this._system.onResize()
  }

  /**
   * Per-frame update — advances OrbitControls damping and HUD display.
   * @param {number} delta  - seconds since last frame
   */
  update(delta) {
    this._system.update(delta)
  }

  // ── Accessors ────────────────────────────────────────────────────────────────

  /** @returns {Three.PerspectiveCamera} */
  get camera() {
    return this._system.camera
  }

  /** @returns {import('three/addons/controls/OrbitControls.js').OrbitControls} */
  get controls() {
    return this._system.controls
  }
}
