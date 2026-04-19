import { EventBus } from './EventBus.js'

/**
 * Tween — animates a single numeric property on a target object over time.
 *
 * The `prop` supports dot-notation paths, e.g. 'position.x', 'material.opacity'.
 *
 * @example
 *   anim.tween({ target: mesh, prop: 'position.y', from: 0, to: 5, duration: 1.5, ease: 'power2out' })
 */
export class Tween {
  /**
   * @param {object} opts
   * @param {object}  opts.target    Object that owns the property
   * @param {string}  opts.prop      Property path, e.g. 'position.x'
   * @param {number}  opts.from      Start value
   * @param {number}  opts.to        End value
   * @param {number}  opts.duration  Duration in seconds
   * @param {string}  [opts.ease]    Easing name (default: 'linear')
   * @param {number}  [opts.delay]   Delay before starting (seconds, default: 0)
   * @param {Function} [opts.onComplete]  Called when tween finishes
   */
  constructor({ target, prop, from, to, duration, ease = 'linear', delay = 0, onComplete = null }) {
    this.target = target
    this.prop = prop
    this.from = from
    this.to = to
    this.duration = duration
    this.ease = ease
    this.delay = delay
    this.onComplete = onComplete
    /** Internal timer: starts negative to handle delay */
    this._time = -delay
    this._done = false
  }

  /**
   * Advance the tween by dt seconds.
   * @param {number} dt
   */
  update(dt) {
    if (this._done) return
    this._time += dt
    if (this._time < 0) return  // still in delay

    const t = Math.min(this._time / this.duration, 1)
    const et = AnimationSystem.ease(t, this.ease)
    const val = this.from + (this.to - this.from) * et
    AnimationSystem._setDeep(this.target, this.prop, val)

    if (t >= 1) {
      this._done = true
      if (typeof this.onComplete === 'function') {
        try { this.onComplete(this) } catch (err) { console.error('[Tween] onComplete error:', err) }
      }
    }
  }

  /** @returns {boolean} true once the tween has completed */
  get done() { return this._done }

  /** Force-complete the tween immediately (jumps to final value). */
  finish() {
    if (this._done) return
    AnimationSystem._setDeep(this.target, this.prop, this.to)
    this._done = true
    if (typeof this.onComplete === 'function') {
      try { this.onComplete(this) } catch (err) { console.error('[Tween] onComplete error:', err) }
    }
  }
}

/**
 * ReactiveBinding — maps an audio FFT band to a numeric property on an object.
 *
 * The `source` is one of: 'fft.bass', 'fft.mid', 'fft.high'.
 * The band value (0–1) is mapped linearly into [min, max] and written to
 * `target[prop]` (dot-notation supported) every frame the bus fires 'audio:fft'.
 *
 * @example
 *   anim.bind({ source: 'fft.bass', target: mesh.scale, prop: 'y', min: 1, max: 3 })
 */
export class ReactiveBinding {
  /**
   * @param {object} opts
   * @param {string}  opts.source  'fft.bass' | 'fft.mid' | 'fft.high'
   * @param {object}  opts.target  Object that owns the property
   * @param {string}  opts.prop    Property path (dot-notation OK)
   * @param {number}  [opts.min]   Mapped minimum (default: 0)
   * @param {number}  [opts.max]   Mapped maximum (default: 1)
   */
  constructor(opts) {
    this.source = opts.source   // 'fft.bass' | 'fft.mid' | 'fft.high'
    this.target = opts.target
    this.prop = opts.prop
    this.min = opts.min ?? 0
    this.max = opts.max ?? 1
    // Cache the band key so update() is allocation-free
    this._band = this.source.split('.')[1]  // 'bass', 'mid', or 'high'
  }

  /**
   * Apply the binding using the latest FFT snapshot.
   * @param {{ bass: number, mid: number, high: number }} fftData
   */
  update(fftData) {
    const raw = fftData?.[this._band] ?? 0
    const val = this.min + (this.max - this.min) * raw
    AnimationSystem._setDeep(this.target, this.prop, val)
  }
}

/**
 * AnimationSystem — manages tweens and audio-reactive bindings.
 *
 * Call `update(dt)` once per frame (after TimeManager.tick) to advance all
 * active tweens.  Reactive bindings are driven automatically by the
 * 'audio:fft' event on the EventBus.
 *
 * @example
 *   const anim = new AnimationSystem(bus)
 *
 *   // Keyframe tween
 *   anim.tween({ target: mesh.position, prop: 'y', from: 0, to: 5, duration: 2, ease: 'power2out' })
 *
 *   // Audio-reactive binding
 *   anim.bind({ source: 'fft.bass', target: mesh.scale, prop: 'x', min: 1, max: 2 })
 *
 *   // In render loop:
 *   anim.update(time.dt)
 */
export class AnimationSystem {
  /**
   * @param {EventBus} [bus]  If provided, subscribes to 'audio:fft' for reactive bindings.
   */
  constructor(bus) {
    this._bus = bus ?? null
    /** @type {Tween[]} */
    this._tweens = []
    /** @type {ReactiveBinding[]} */
    this._bindings = []

    if (bus) {
      bus.on('audio:fft', ({ bass, mid, high }) => {
        const fftData = { bass, mid, high }
        for (const b of this._bindings) b.update(fftData)
      })
    }
  }

  /**
   * Add a pre-constructed Tween to the system.
   * @param {Tween} tween
   * @returns {Tween}
   */
  add(tween) {
    this._tweens.push(tween)
    return tween
  }

  /**
   * Create and add a Tween from an options object.
   * @param {object} opts  Same options as the Tween constructor.
   * @returns {Tween}
   */
  tween(opts) {
    return this.add(new Tween(opts))
  }

  /**
   * Create and register a ReactiveBinding.
   * @param {object} opts  Same options as the ReactiveBinding constructor.
   * @returns {ReactiveBinding}
   */
  bind(opts) {
    const b = new ReactiveBinding(opts)
    this._bindings.push(b)
    return b
  }

  /**
   * Remove a specific ReactiveBinding.
   * @param {ReactiveBinding} binding
   */
  unbind(binding) {
    const idx = this._bindings.indexOf(binding)
    if (idx >= 0) this._bindings.splice(idx, 1)
  }

  /**
   * Advance all active tweens by dt seconds.
   * Completed tweens are automatically removed.
   * @param {number} dt
   */
  update(dt) {
    if (this._tweens.length === 0) return
    this._tweens = this._tweens.filter(t => {
      t.update(dt)
      return !t.done
    })
  }

  /**
   * Immediately finish and remove all active tweens.
   */
  flush() {
    for (const t of this._tweens) t.finish()
    this._tweens = []
  }

  // -------------------------------------------------------------------------
  // Static helpers
  // -------------------------------------------------------------------------

  /**
   * Evaluate an easing function.
   * @param {number} t    Progress in [0, 1]
   * @param {string} name Easing name
   * @returns {number}
   */
  static ease(t, name) {
    switch (name) {
      case 'linear':    return t
      case 'power2':    return t * t
      case 'power3':    return t * t * t
      case 'power2out': return 1 - (1 - t) * (1 - t)
      case 'power3out': return 1 - (1 - t) ** 3
      case 'sine':      return 1 - Math.cos(t * Math.PI / 2)
      case 'sineInOut': return -(Math.cos(Math.PI * t) - 1) / 2
      case 'elastic':
        if (t === 0) return 0
        if (t === 1) return 1
        return -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * (2 * Math.PI) / 3)
      case 'elasticOut':
        if (t === 0) return 0
        if (t === 1) return 1
        return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1
      case 'bounce': {
        const n1 = 7.5625, d1 = 2.75
        let x = t
        if (x < 1 / d1)       return n1 * x * x
        if (x < 2 / d1)       return n1 * (x -= 1.5   / d1) * x + 0.75
        if (x < 2.5 / d1)     return n1 * (x -= 2.25  / d1) * x + 0.9375
        return n1 * (x -= 2.625 / d1) * x + 0.984375
      }
      default: return t
    }
  }

  /**
   * Set a (possibly nested) property on an object via a dot-notation path.
   * Silently does nothing if any intermediate key is null/undefined.
   * @param {object} target
   * @param {string} prop   e.g. 'position.x'
   * @param {*}      value
   */
  static _setDeep(target, prop, value) {
    if (typeof prop !== 'string' || target == null) return
    const parts = prop.split('.')
    let obj = target
    for (let i = 0; i < parts.length - 1; i++) {
      obj = obj?.[parts[i]]
      if (obj == null) return
    }
    obj[parts[parts.length - 1]] = value
  }
}
