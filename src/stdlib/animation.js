/**
 * artlab/animation
 *
 * High-level animation helpers for Artlab DSL programs.
 * Wraps AnimationSystem, Tween, and ReactiveBinding from the runtime layer
 * and adds convenience functions for tweens, audio-reactive bindings,
 * and keyframe timelines.
 *
 * @module artlab/animation
 *
 * @example
 *   import { tween, audioReact, timeline, animations } from 'artlab/animation'
 *
 *   // One-shot position tween
 *   tween(mesh.position, { y: 5 }, 2.0, { easing: 'power2out' })
 *
 *   // Audio-reactive scale
 *   const binding = audioReact(mesh.scale, 'x', 'bass', { min: 1, max: 3 })
 *
 *   // Keyframe timeline
 *   const tl = timeline([
 *     { t: 0,   props: { [mesh.position]: { y: 0 } } },
 *     { t: 2,   props: { [mesh.position]: { y: 5 } } },
 *     { t: 4,   props: { [mesh.position]: { y: 0 } } },
 *   ])
 *   tl.play()
 *
 *   // In render loop (pass dt in seconds):
 *   animations.update(dt)
 */

export { AnimationSystem, Tween, ReactiveBinding } from '../runtime/AnimationSystem.js'

import { AnimationSystem, Tween } from '../runtime/AnimationSystem.js'

// ---------------------------------------------------------------------------
// Global singleton
// ---------------------------------------------------------------------------

/**
 * Module-level AnimationSystem singleton.
 *
 * All convenience functions (tween, audioReact) register with this instance.
 * Call `animations.update(dt)` once per frame in your render loop.
 *
 * If you need a separate system (e.g. with its own EventBus for audio FFT),
 * construct one directly: `new AnimationSystem(bus)`.
 */
export const animations = new AnimationSystem()

// ---------------------------------------------------------------------------
// tween()
// ---------------------------------------------------------------------------

/**
 * Create and start a tween on the global `animations` singleton.
 *
 * `to` is a flat map of property paths (dot-notation) to target values.
 * Each key generates one Tween registered with `animations`.
 *
 * @param {object} target     Object that owns the properties to animate
 * @param {object} to         Map of { propPath: targetValue } (dot-notation OK)
 * @param {number} duration   Duration in seconds
 * @param {object} [options]
 * @param {string}   [options.easing]     Easing name passed to AnimationSystem.ease()
 * @param {number}   [options.delay]      Delay before starting (seconds)
 * @param {Function} [options.onComplete] Called when ALL tweens in this call finish
 * @returns {Tween[]}  Array of Tween objects (one per property); call `.finish()` to cancel
 *
 * @example
 *   const ts = tween(mesh.position, { y: 5 }, 2, { easing: 'power2out' })
 *   // later: ts.forEach(t => t.finish())
 */
export function tween(target, to, duration, options = {}) {
  const { easing = 'linear', delay = 0, onComplete = null } = options
  const keys = Object.keys(to)
  const tweens = []
  const total = keys.length

  let completedCount = 0
  const onEachComplete = onComplete
    ? () => { if (++completedCount >= total) onComplete() }
    : null

  for (const prop of keys) {
    // Read current value for `from`, supporting dot-notation
    const from = _getDeep(target, prop) ?? 0
    const t = animations.tween({
      target,
      prop,
      from,
      to: to[prop],
      duration,
      ease:       easing,
      delay,
      onComplete: onEachComplete,
    })
    tweens.push(t)
  }

  return tweens
}

// ---------------------------------------------------------------------------
// audioReact()
// ---------------------------------------------------------------------------

/**
 * Create an audio-reactive binding on the global `animations` singleton.
 *
 * The binding maps an FFT band value (0–1) to a numeric property on `target`.
 * The global `animations` must receive 'audio:fft' events from an EventBus
 * (or you can drive it manually via `animations._bindings`).
 *
 * @param {object} target         Object that owns the property
 * @param {string} prop           Property path (dot-notation OK, e.g. 'scale.y')
 * @param {'bass'|'mid'|'high'} band  FFT band to track
 * @param {object} [options]
 * @param {number}   [options.min]       Mapped minimum (default 0)
 * @param {number}   [options.max]       Mapped maximum (default 1)
 * @param {number}   [options.smoothing] Unused for now; reserved for future EMA smoothing
 * @returns {{ disconnect(): void }}  Call `.disconnect()` to remove the binding
 *
 * @example
 *   const b = audioReact(mesh.scale, 'x', 'bass', { min: 1, max: 3 })
 *   // later: b.disconnect()
 */
export function audioReact(target, prop, band, options = {}) {
  const { min = 0, max = 1 } = options
  const binding = animations.bind({
    source: `fft.${band}`,
    target,
    prop,
    min,
    max,
  })
  return {
    /** Remove this binding from the global animation system. */
    disconnect() {
      animations.unbind(binding)
    },
    /** Underlying ReactiveBinding for advanced use. */
    _binding: binding,
  }
}

// ---------------------------------------------------------------------------
// timeline()
// ---------------------------------------------------------------------------

/**
 * Build a keyframe timeline from an array of keyframe descriptors.
 *
 * Keyframes are sorted by `t` (time in seconds).  When the timeline is
 * played, `animations.update(dt)` drives playback — the timeline hooks into
 * the existing tween machinery rather than spawning its own loop.
 *
 * @param {Array<{ t: number, props: Object<object, Object<string, number>> }>} keyframes
 *   Each keyframe has:
 *   - `t`     Time in seconds
 *   - `props` Map of target-object → { propPath: value }
 *             Keys must be the actual target objects (not strings).
 *
 * @returns {{
 *   seek(t: number): void,
 *   play(speed?: number): void,
 *   pause(): void,
 *   onComplete(cb: Function): void,
 * }}
 *
 * @example
 *   const tl = timeline([
 *     { t: 0, props: new Map([[mesh.position, { y: 0 }]]) },
 *     { t: 2, props: new Map([[mesh.position, { y: 5 }]]) },
 *   ])
 *   tl.play()
 *   // In render loop: animations.update(dt)  — no separate loop needed
 */
export function timeline(keyframes) {
  // Normalise keyframes: accept both Map and plain object for props
  const kfs = [...keyframes]
    .sort((a, b) => a.t - b.t)
    .map(kf => ({
      t:     kf.t,
      props: kf.props instanceof Map ? kf.props : _objectToMap(kf.props),
    }))

  let _speed        = 1
  let _playing      = false
  let _currentTime  = 0
  let _completeCbs  = []
  let _activeTweens = []

  /** Cancel all currently running tweens spawned by this timeline. */
  function _cancelActive() {
    for (const t of _activeTweens) t.finish()
    _activeTweens = []
  }

  /**
   * Schedule tweens between keyframe `from` and keyframe `to`.
   * @param {object} fromKf  Earlier keyframe
   * @param {object} toKf    Later keyframe
   */
  function _scheduleTweens(fromKf, toKf) {
    const duration = (toKf.t - fromKf.t) / _speed
    if (duration <= 0) return

    toKf.props.forEach((propMap, target) => {
      for (const [prop, toVal] of Object.entries(propMap)) {
        const fromVal = fromKf.props.has(target)
          ? (fromKf.props.get(target)[prop] ?? _getDeep(target, prop) ?? 0)
          : (_getDeep(target, prop) ?? 0)

        const tw = animations.tween({
          target,
          prop,
          from: fromVal,
          to:   toVal,
          duration,
          ease: 'linear',
        })
        _activeTweens.push(tw)
      }
    })
  }

  /** Find the keyframe pair bracketing `t` and schedule tweens. */
  function _buildFromTime(t) {
    _cancelActive()
    _currentTime = t

    for (let i = 0; i < kfs.length - 1; i++) {
      if (t >= kfs[i].t && t < kfs[i + 1].t) {
        _scheduleTweens(kfs[i], kfs[i + 1])
        return
      }
    }
    // Past the last keyframe — snap to final values
    const last = kfs[kfs.length - 1]
    if (last) {
      last.props.forEach((propMap, target) => {
        for (const [prop, val] of Object.entries(propMap)) {
          _setDeep(target, prop, val)
        }
      })
    }
  }

  // We need to advance _currentTime each frame while playing.
  // Hook into a synthetic per-frame callback via a zero-duration self-renewing
  // tween on a throwaway object, OR (simpler) expose an `update(dt)` and
  // recommend calling it from the render loop.  We choose the former approach
  // by storing a lightweight frame-hook tween that never completes.
  const _clock = { _t: 0 }
  let _frameHook = null

  function _startFrameHook() {
    if (_frameHook) return
    // A tween on a dummy property that runs for a very long time.
    // Its side-effect fires every frame: we hijack onComplete to restart.
    function hookStep() {
      if (!_playing) { _frameHook = null; return }
      // Use a 1-second "tick" tween that advances _currentTime by _speed.
      _frameHook = animations.tween({
        target:   _clock,
        prop:     '_t',
        from:     0,
        to:       1,
        duration: 1,
        ease:     'linear',
        onComplete() {
          if (!_playing) { _frameHook = null; return }
          _currentTime += 1 * _speed
          // Check if we've reached or passed the last keyframe
          const lastT = kfs.length ? kfs[kfs.length - 1].t : 0
          if (_currentTime >= lastT) {
            _playing = false
            _frameHook = null
            for (const cb of _completeCbs) { try { cb() } catch (e) { /* ignore */ } }
            return
          }
          _buildFromTime(_currentTime)
          hookStep()  // chain next 1-second tick
        },
      })
    }
    hookStep()
  }

  return {
    /**
     * Jump the playhead to time `t` (seconds) and apply values immediately.
     * @param {number} t
     */
    seek(t) {
      _playing = false
      _cancelActive()
      _buildFromTime(Math.max(0, t))
    },

    /**
     * Start or resume playback.
     * @param {number} [speed=1]  Playback speed multiplier
     */
    play(speed = 1) {
      _speed   = speed
      _playing = true
      if (kfs.length < 2) return
      _buildFromTime(_currentTime)
      _startFrameHook()
    },

    /** Pause playback without resetting the playhead. */
    pause() {
      _playing = false
      if (_frameHook) {
        _frameHook.finish()
        _frameHook = null
      }
    },

    /**
     * Register a callback to be called when the timeline reaches the last keyframe.
     * @param {Function} cb
     */
    onComplete(cb) {
      _completeCbs.push(cb)
    },
  }
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Read a (possibly nested) property using dot-notation.
 * @param {object} target
 * @param {string} prop
 * @returns {*}
 */
function _getDeep(target, prop) {
  if (target == null || typeof prop !== 'string') return undefined
  const parts = prop.split('.')
  let obj = target
  for (const key of parts) {
    if (obj == null) return undefined
    obj = obj[key]
  }
  return obj
}

/**
 * Set a (possibly nested) property using dot-notation.
 * @param {object} target
 * @param {string} prop
 * @param {*} value
 */
function _setDeep(target, prop, value) {
  if (target == null || typeof prop !== 'string') return
  const parts = prop.split('.')
  let obj = target
  for (let i = 0; i < parts.length - 1; i++) {
    obj = obj?.[parts[i]]
    if (obj == null) return
  }
  obj[parts[parts.length - 1]] = value
}

/**
 * Convert a plain object { target: propMap } to a Map<target, propMap>.
 * In plain-object form the keys are strings (not object references), so
 * this helper is mostly a fallback — callers should prefer passing a Map.
 */
function _objectToMap(obj) {
  const m = new Map()
  for (const [k, v] of Object.entries(obj)) m.set(k, v)
  return m
}
