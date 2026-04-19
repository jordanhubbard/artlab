/**
 * TimeManager — manages simulation time for all Artlab systems.
 *
 * Usage in your render loop:
 *   function loop(timestamp) {
 *     time.tick(timestamp)
 *     while (time.fixedStep()) {
 *       physics.step(time.elapsed, time.fixedDt)
 *     }
 *     anim.update(time.dt)
 *     bus.emit('scene:update', { elapsed: time.elapsed, dt: time.dt })
 *     renderer.render(scene, camera)
 *     requestAnimationFrame(loop)
 *   }
 *   requestAnimationFrame(loop)
 */
export class TimeManager {
  constructor() {
    /** @type {number|null} */
    this._startTime = null
    /** @type {number|null} */
    this._lastTime = null
    /** Total scaled time elapsed (seconds) */
    this._elapsed = 0
    /** Delta time for this frame (seconds, scaled) */
    this._dt = 0
    /** Time scale multiplier (1 = real-time, 0.5 = half-speed, 2 = double-speed) */
    this._timeScale = 1.0
    /** Fixed physics step size (seconds) */
    this._fixedDt = 1 / 60
    /** Accumulator for fixed-step physics */
    this._accumulator = 0
    this._paused = false
  }

  /**
   * Call at the start of each animation frame with the raw timestamp from
   * requestAnimationFrame (milliseconds since page load).
   * @param {number} timestamp  — from rAF callback
   */
  tick(timestamp) {
    if (this._startTime === null) {
      this._startTime = timestamp
      this._lastTime = timestamp
      // dt stays 0 on the first frame — systems should handle dt=0 gracefully
      return
    }

    // Cap raw delta to 100 ms to avoid spiral-of-death after tab switch/debugger pause
    const rawDt = Math.min((timestamp - this._lastTime) / 1000, 0.1)
    this._lastTime = timestamp

    if (!this._paused) {
      this._dt = rawDt * this._timeScale
      this._elapsed += this._dt
      this._accumulator += this._dt
    } else {
      this._dt = 0
    }
  }

  // -------------------------------------------------------------------------
  // Getters
  // -------------------------------------------------------------------------

  /** Scaled delta time for the current frame (seconds). */
  get dt() { return this._dt }

  /** Total scaled time elapsed since the first tick (seconds). */
  get elapsed() { return this._elapsed }

  /** Fixed physics step size (seconds). Default: 1/60. */
  get fixedDt() { return this._fixedDt }

  /** Set the fixed physics step size (seconds). */
  set fixedDt(v) { this._fixedDt = Math.max(0.001, v) }

  /**
   * Drain the accumulator for fixed-step physics.
   * Call in a while loop before variable rendering:
   *   while (time.fixedStep()) { physics.step(time.elapsed, time.fixedDt) }
   * @returns {boolean}
   */
  fixedStep() {
    if (this._accumulator >= this._fixedDt) {
      this._accumulator -= this._fixedDt
      return true
    }
    return false
  }

  /** Time scale multiplier. 1.0 = real-time. Must be >= 0. */
  get timeScale() { return this._timeScale }
  set timeScale(v) { this._timeScale = Math.max(0, v) }

  /** Whether time is paused. */
  get paused() { return this._paused }

  /** Pause time (dt will be 0). */
  pause() { this._paused = true }

  /** Resume time. */
  resume() { this._paused = false }

  /** Toggle pause state. */
  toggle() { this._paused = !this._paused }

  /**
   * Frames per second (computed from the last dt).
   * Returns 0 when paused or on the first frame.
   */
  get fps() { return this._dt > 0 ? 1 / this._dt : 0 }

  /**
   * Reset all timing state. Useful when switching scenes.
   */
  reset() {
    this._startTime = null
    this._lastTime = null
    this._elapsed = 0
    this._dt = 0
    this._accumulator = 0
    this._paused = false
  }
}
