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

import * as Tone             from 'tone'
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
// Teardown
// ---------------------------------------------------------------------------

/**
 * Fully stop and release all audio resources for the current scene.
 * Dispose FFT nodes, stop Transport, close the AudioContext, and reset
 * Tone.js to a fresh context so the next example can call start() cleanly.
 * Call this before loading a new example / package.
 */
export async function stop() {
  // 1. Dispose FFT / Meter nodes before the context closes.
  fft.dispose()

  // 2. Tear down AudioEngine (stops Transport, disposes chain, closes context,
  //    installs a fresh Tone.Context).
  await engine.stop()

  // 3. Drop the asset-loader reference — its AudioContext is now closed.
  _assetLoader = null
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
// Music theory — NOTE_FREQ table
// ---------------------------------------------------------------------------

/** Equal-temperament note frequencies (A4 = 440 Hz), C0 through B8. */
const _CHROMATIC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export const NOTE_FREQ = (() => {
  const table = {}
  for (let oct = 0; oct <= 8; oct++) {
    _CHROMATIC.forEach((note, i) => {
      const semitonesFromA4 = (oct - 4) * 12 + i - 9
      table[`${note}${oct}`] = 440 * Math.pow(2, semitonesFromA4 / 12)
    })
  }
  return table
})()

// ---------------------------------------------------------------------------
// Music theory — scale generator
// ---------------------------------------------------------------------------

const _SCALE_INTERVALS = {
  major:           [0, 2, 4, 5, 7, 9, 11],
  minor:           [0, 2, 3, 5, 7, 8, 10],
  dorian:          [0, 2, 3, 5, 7, 9, 10],
  phrygian:        [0, 1, 3, 5, 7, 8, 10],
  lydian:          [0, 2, 4, 6, 7, 9, 11],
  mixolydian:      [0, 2, 4, 5, 7, 9, 10],
  locrian:         [0, 1, 3, 5, 6, 8, 10],
  pentatonic:      [0, 2, 4, 7, 9],
  pentatonic_minor:[0, 3, 5, 7, 10],
  chromatic:       [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
}

/**
 * Generate note names in a scale across one or more octaves.
 * @param {string} root        Root note name, e.g. 'A', 'C', 'F#'
 * @param {string} [mode='minor']  Scale mode
 * @param {number} [octaves=2]     Number of octaves to span
 * @param {number} [startOctave=3] Starting octave number
 * @returns {string[]}  e.g. ['A3','C4','D4','E4','G4','A4',...]
 */
export function scale(root, mode = 'minor', octaves = 2, startOctave = 3) {
  const intervals = _SCALE_INTERVALS[mode]
  if (!intervals) throw new Error(`[artlab/audio] Unknown scale mode: ${mode}`)

  const rootIdx = _CHROMATIC.indexOf(root)
  if (rootIdx === -1) throw new Error(`[artlab/audio] Unknown root note: ${root}`)

  const notes = []
  for (let oct = 0; oct < octaves; oct++) {
    for (const interval of intervals) {
      const semitone  = rootIdx + interval + oct * 12
      const noteOct   = startOctave + Math.floor(semitone / 12)
      const noteName  = _CHROMATIC[semitone % 12]
      notes.push(`${noteName}${noteOct}`)
    }
  }
  // Add the octave-end root note for completeness
  const endSemitone = rootIdx + octaves * 12
  notes.push(`${_CHROMATIC[endSemitone % 12]}${startOctave + Math.floor(endSemitone / 12)}`)
  return notes
}

// ---------------------------------------------------------------------------
// Music theory — chord generator
// ---------------------------------------------------------------------------

const _CHORD_INTERVALS = {
  maj:  [0, 4, 7],
  min:  [0, 3, 7],
  dim:  [0, 3, 6],
  aug:  [0, 4, 8],
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
  dom7: [0, 4, 7, 10],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
}

/**
 * Return note names for a chord built on a root + octave string.
 * @param {string} root     Root note + octave, e.g. 'A3'
 * @param {string} [quality='min']  Chord quality
 * @returns {string[]}  e.g. ['A3','C4','E4']
 */
export function chord(root, quality = 'min') {
  const intervals = _CHORD_INTERVALS[quality]
  if (!intervals) throw new Error(`[artlab/audio] Unknown chord quality: ${quality}`)

  // Split 'A3' → noteName='A', octave=3
  const match = root.match(/^([A-G]#?)(\d+)$/)
  if (!match) throw new Error(`[artlab/audio] Invalid root note: ${root}`)
  const [, noteName, octStr] = match

  const rootIdx  = _CHROMATIC.indexOf(noteName)
  const rootOct  = parseInt(octStr, 10)
  const rootSemi = rootOct * 12 + rootIdx   // absolute semitone from C0

  return intervals.map(interval => {
    const semi = rootSemi + interval
    const oct  = Math.floor(semi / 12)
    const name = _CHROMATIC[semi % 12]
    return `${name}${oct}`
  })
}

// ---------------------------------------------------------------------------
// Music theory — chord progression generator
// ---------------------------------------------------------------------------

// Roman numeral → zero-based scale degree (supports upper and lower case)
const _NUMERAL_DEGREE = { I: 0, II: 1, III: 2, IV: 3, V: 4, VI: 5, VII: 6 }

/**
 * Return a chord progression as arrays of note names.
 * @param {string} root           Root note name (no octave), e.g. 'A'
 * @param {string} progressionStr Roman-numeral string, e.g. 'i-VI-III-VII'
 * @param {string} [mode='minor'] Scale mode used to map degrees to roots
 * @param {number} [octave=3]     Starting octave
 * @returns {string[][]}  Array of chord note arrays
 */
export function progression(root, progressionStr, mode = 'minor', octave = 3) {
  const scaleNotes = scale(root, mode, 1, octave)  // one-octave scale
  const numerals   = progressionStr.split('-')

  return numerals.map(numeral => {
    const isMinor  = numeral === numeral.toLowerCase()
    const upper    = numeral.toUpperCase()
    const degree   = _NUMERAL_DEGREE[upper]
    if (degree === undefined) throw new Error(`[artlab/audio] Unknown numeral: ${numeral}`)

    const chordRoot = scaleNotes[degree]  // e.g. 'A3'
    const quality   = isMinor ? 'min' : 'maj'
    return chord(chordRoot, quality)
  })
}

// ---------------------------------------------------------------------------
// Effects factories (Tone.js wrappers)
// ---------------------------------------------------------------------------

/** Create a Tone.Reverb with sensible ambient defaults. */
export function reverb(opts = {}) {
  const { decay = 4, wet = 0.5, preDelay = 0.01 } = opts
  const node = new Tone.Reverb({ decay, preDelay })
  node.wet.value = wet
  return node
}

/** Create a Tone.FeedbackDelay. */
export function delay(opts = {}) {
  const { delayTime = '8n', feedback = 0.4, wet = 0.3 } = opts
  return new Tone.FeedbackDelay({ delayTime, feedback, wet })
}

/** Create a Tone.Chorus for thickening sounds. */
export function chorus(opts = {}) {
  const { frequency = 1.5, delayTime = 3.5, depth = 0.7 } = opts
  return new Tone.Chorus({ frequency, delayTime, depth })
}

// ---------------------------------------------------------------------------
// Sequencer helper
// ---------------------------------------------------------------------------

/**
 * Create a simple step sequencer that plays notes from a pattern.
 * Returns a handle with start() / stop() / setNotes(notes) / setTempo(bpm) / dispose().
 *
 * @param {object}   opts
 * @param {string[]} opts.notes       Initial note array
 * @param {string}   [opts.subdivision='8n']  Tone.js time string
 * @param {number}   [opts.bpm=90]    Tempo
 * @param {function} opts.onStep      Callback(note, index) called on each step
 * @returns {{ start(), stop(), setNotes(notes), setTempo(bpm), dispose() }}
 */
export function sequencer(opts = {}) {
  const { notes: initialNotes = [], subdivision = '8n', bpm = 90, onStep } = opts

  let _notes = [...initialNotes]
  let _index = 0

  Tone.Transport.bpm.value = bpm

  const seq = new Tone.Sequence((time, note) => {
    if (typeof onStep === 'function') onStep(note, _index)
    _index = (_index + 1) % _notes.length
  }, _notes, subdivision)

  return {
    /** Start the sequencer (also starts Tone.Transport if not already running). */
    start() {
      seq.start(0)
      Tone.Transport.start()
    },
    /** Stop the sequencer. */
    stop() {
      seq.stop()
    },
    /** Replace the note pattern at runtime. */
    setNotes(notes) {
      _notes  = [...notes]
      _index  = 0
      seq.events = _notes
    },
    /** Change the Transport tempo. */
    setTempo(newBpm) {
      Tone.Transport.bpm.value = newBpm
    },
    /** Dispose the underlying Tone.Sequence. */
    dispose() {
      seq.stop()
      seq.dispose()
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
