/**
 * artlab/audio — Audio stdlib for the Artlab DSL
 *
 * DSL programs import this module via:
 *   use "artlab/audio"
 *
 * Quick reference:
 *   await start()            — resume audio context (call from user gesture)
 *   update()                 — call each frame; returns { bass, mid, high, raw }
 *   band('bass'|'mid'|'high') — current FFT band value (0..1) for the given band
 *   await play(src, opts)    — one-shot sound playback from URL or package path
 *   pad(opts)                — ambient synth pad; returns { setVolume, dispose }
 *   spatialize(node, opts)   — spatial panner tied to a Three.js object
 */

import { Vector3 }          from 'three'
import { AudioEngine }      from '../audio/AudioEngine.js'
import { FFTPipeline }      from '../audio/FFTPipeline.js'
import { AudioAssetLoader } from '../assets/AudioAssetLoader.js'

// ---------------------------------------------------------------------------
// Module-level singletons — shared across DSL modules within a scene
// ---------------------------------------------------------------------------

/** Shared AudioEngine instance (Tone.js wrapper). */
export const engine = AudioEngine.getInstance ? AudioEngine.getInstance() : new AudioEngine()

/** Shared FFTPipeline instance for per-frame band analysis. */
export const fft = new FFTPipeline()

// Internal asset loader — created lazily after start() resolves.
let _assetLoader = null

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

/**
 * Start the audio system.
 * Must be called from a user-gesture handler (click, keydown, etc.).
 * Idempotent — safe to call more than once.
 */
export async function start() {
  await engine.start()
  fft.connect(engine)

  // Build the asset loader now that AudioContext is available.
  const ctx = engine.audioContext
  if (ctx && !_assetLoader) {
    _assetLoader = new AudioAssetLoader(ctx)
  }
}

// ---------------------------------------------------------------------------
// Per-frame update
// ---------------------------------------------------------------------------

/**
 * Analyse the latest audio frame.  Call once per animation frame from the
 * DSL update() loop.
 *
 * @returns {{ bass: number, mid: number, high: number, raw: Float32Array|null }}
 *   Normalised band values in [0, 1] and the raw FFT data array.
 */
export function update() {
  fft.update()
  const d = fft.data
  return {
    bass: d.bass,
    mid:  d.mid,
    high: d.treble,   // 'high' is the public alias for the treble band
    raw:  d.raw ?? null,
  }
}

// ---------------------------------------------------------------------------
// Band accessor
// ---------------------------------------------------------------------------

/**
 * Return the current FFT band value (0..1) for the named band.
 * Convenient for audio-reactive expressions that need just one value.
 *
 * @param {'bass'|'mid'|'high'|'treble'} name
 * @returns {number}
 */
export function band(name) {
  const d = fft.data
  if (!d) return 0
  // Accept both 'high' (public DSL name) and 'treble' (internal FFTPipeline name).
  if (name === 'high' || name === 'treble') return d.treble ?? 0
  return d[name] ?? 0
}

// ---------------------------------------------------------------------------
// One-shot playback
// ---------------------------------------------------------------------------

/**
 * Play a sound from a URL or package-relative path.
 * Returns the AudioBufferSourceNode so callers can stop it early if needed.
 *
 * @param {string} src           URL or package-relative path
 * @param {object} [options]
 * @param {number}  [options.volume=1]    linear gain (0..1+)
 * @param {boolean} [options.loop=false]
 * @param {number}  [options.detune=0]    cents
 * @returns {Promise<AudioBufferSourceNode>}
 */
export async function play(src, options = {}) {
  const { volume = 1, loop = false, detune = 0 } = options

  if (!_assetLoader) {
    throw new Error('[artlab/audio] call start() before play()')
  }

  const buffer = await _assetLoader.load(src)

  // Route through the Tone.js master chain when available; fall back to the
  // raw AudioContext destination so the master effects still apply.
  const ctx  = engine.audioContext
  const dest = engine.Tone
    ? (engine.Tone.getDestination?.()?.input ?? ctx.destination)
    : ctx.destination

  return _assetLoader.playOnce(buffer, dest, { volume, loop, detune })
}

// ---------------------------------------------------------------------------
// Ambient synth pad
// ---------------------------------------------------------------------------

/**
 * Create a general-purpose ambient synth pad via Tone.js.
 * Returns a controller object with setVolume() and dispose().
 *
 * @param {object} [options]
 * @param {string}  [options.note='C3']        MIDI note name or frequency
 * @param {string}  [options.type='sine']      oscillator type
 * @param {boolean} [options.reverb=true]      connect through engine reverb chain
 * @returns {{ setVolume: (db: number) => void, dispose: () => void }}
 */
export function pad(options = {}) {
  const { note = 'C3', type = 'sine', reverb = true } = options

  const Tone = engine.Tone

  // If Tone.js is not yet available (start() not called), return a no-op handle.
  if (!Tone) {
    console.warn('[artlab/audio] pad() called before start() — returning no-op handle')
    return {
      setVolume(_db) {},
      dispose()     {},
    }
  }

  // FMSynth with slow attack/release for ambient pads.
  const synth = new Tone.FMSynth({
    harmonicity:     2.5,
    modulationIndex: 10,
    oscillator:         { type },
    envelope:           { attack: 4, decay: 2, sustain: 0.85, release: 8 },
    modulation:         { type: 'triangle' },
    modulationEnvelope: { attack: 6, decay: 1, sustain: 0.9, release: 8 },
  })

  // Volume node so callers can fade in/out independently.
  const vol = new Tone.Volume(-40)   // start silent

  // Connect either through engine master (which has reverb) or directly.
  const destination = (reverb && engine.output) ? engine.output : Tone.getDestination()
  synth.connect(vol)
  vol.connect(destination)

  // Trigger the sustained note immediately.
  synth.triggerAttack(note)

  return {
    /**
     * Ramp pad volume to db decibels over 1.5 s.
     * Use -Infinity to silence, 0 for unity, positive values to boost.
     * @param {number} db
     */
    setVolume(db) {
      vol.volume.rampTo(db, 1.5)
    },

    /** Release the synth and free all Tone.js nodes. */
    dispose() {
      synth.triggerRelease()
      // Allow release tail to fade before disposal.
      setTimeout(() => {
        synth.dispose()
        vol.dispose()
      }, 10_000)
    },
  }
}

// ---------------------------------------------------------------------------
// Spatial audio
// ---------------------------------------------------------------------------

/**
 * Link a Web Audio AudioNode to a Three.js object's world position via a
 * PannerNode.  Call update(obj) each frame to track the object's position.
 *
 * @param {AudioNode} audioNode                source node to spatialise
 * @param {object}    [options]
 * @param {number}     [options.refDistance=1]    distance at which attenuation begins
 * @param {number}     [options.maxDistance=10000] distance at which gain is clamped
 * @param {number}     [options.rolloffFactor=1]   rate of attenuation
 * @param {string}     [options.panningModel='HRTF'] 'HRTF' or 'equalpower'
 * @param {string}     [options.distanceModel='inverse'] Web Audio distance model
 * @returns {{ update: (obj: THREE.Object3D) => void, disconnect: () => void }}
 */
export function spatialize(audioNode, options = {}) {
  const {
    refDistance    = 1,
    maxDistance    = 10_000,
    rolloffFactor  = 1,
    panningModel   = 'HRTF',
    distanceModel  = 'inverse',
  } = options

  const ctx = engine.audioContext

  // If the AudioContext is not yet available, return a deferred handle that
  // wires up on the first update() call once audio has started.
  if (!ctx) {
    let _panner = null
    let _connected = false

    const ensurePanner = () => {
      const liveCtx = engine.audioContext
      if (!liveCtx || _panner) return
      _panner = _createPanner(liveCtx, audioNode, {
        refDistance, maxDistance, rolloffFactor, panningModel, distanceModel,
      })
      _connected = true
    }

    return {
      update(obj) {
        ensurePanner()
        if (_panner) _applyPosition(_panner, obj)
      },
      disconnect() {
        if (_panner) {
          _panner.disconnect()
          _panner = null
          _connected = false
        }
      },
    }
  }

  const panner = _createPanner(ctx, audioNode, {
    refDistance, maxDistance, rolloffFactor, panningModel, distanceModel,
  })

  return {
    /**
     * Update the PannerNode position from the Three.js object's world position.
     * @param {import('three').Object3D} obj
     */
    update(obj) {
      _applyPosition(panner, obj)
    },

    /** Disconnect the PannerNode and release it. */
    disconnect() {
      panner.disconnect()
    },
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Create and configure a PannerNode, connecting audioNode → panner → dest.
 * @param {AudioContext} ctx
 * @param {AudioNode} audioNode
 * @param {object} opts
 * @returns {PannerNode}
 */
function _createPanner(ctx, audioNode, opts) {
  const panner = ctx.createPanner()

  panner.panningModel   = opts.panningModel
  panner.distanceModel  = opts.distanceModel
  panner.refDistance    = opts.refDistance
  panner.maxDistance    = opts.maxDistance
  panner.rolloffFactor  = opts.rolloffFactor

  // Route: source → panner → Tone.js master chain (or raw destination)
  const dest = engine.Tone
    ? (engine.Tone.getDestination?.()?.input ?? ctx.destination)
    : ctx.destination

  audioNode.connect(panner)
  panner.connect(dest)

  return panner
}

/**
 * Copy a Three.js Object3D world position into a PannerNode.
 * Uses setPosition() for broad Web Audio API compatibility, with a fallback
 * to AudioParam.value assignment for implementations that omit setPosition().
 *
 * @param {PannerNode} panner
 * @param {import('three').Object3D} obj
 */
function _applyPosition(panner, obj) {
  // Compute world position (works even when the object has a parent transform).
  const pos = _worldPosition(obj)

  if (typeof panner.positionX !== 'undefined') {
    // Modern Web Audio API — use AudioParams for sample-accurate updates.
    panner.positionX.value = pos.x
    panner.positionY.value = pos.y
    panner.positionZ.value = pos.z
  } else if (typeof panner.setPosition === 'function') {
    panner.setPosition(pos.x, pos.y, pos.z)
  }
}

// Reusable scratch vector for world-position queries — avoids per-frame allocation.
const _scratchVec3 = new Vector3()

/**
 * Return the world-space position of a Three.js Object3D.
 * Uses getWorldPosition() so parent transforms are resolved correctly.
 * Falls back to local position for non-Three.js objects.
 *
 * @param {import('three').Object3D} obj
 * @returns {Vector3}
 */
function _worldPosition(obj) {
  if (typeof obj.getWorldPosition === 'function') {
    return obj.getWorldPosition(_scratchVec3)
  }
  // Fallback: use local position (no parent-transform resolution).
  const p = obj.position ?? { x: 0, y: 0, z: 0 }
  return _scratchVec3.set(p.x, p.y, p.z)
}
