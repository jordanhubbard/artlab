import { AudioEngine }      from './AudioEngine.js'
import { FFTPipeline }      from './FFTPipeline.js'
import { AudioAssetLoader } from '../assets/AudioAssetLoader.js'

/**
 * ArtlabAudio — high-level audio facade for Artlab packages.
 *
 * Wraps AudioEngine (Tone.js), FFTPipeline (real-time analysis) and
 * AudioAssetLoader (buffered file loading) into a single coordinated API.
 *
 * Usage:
 *   const audio = new ArtlabAudio(eventBus, packageReader)
 *   await audio.start()          // must be called from a user-gesture handler
 *   // in animation loop:
 *   audio.update()
 *   const { bass, mid, treble } = audio.data
 *   // load & play a sound:
 *   const buf = await audio.loadSound('audio/boom.ogg')
 *   audio.engine.createSource(buf).start()
 */
export class ArtlabAudio {
  /**
   * @param {import('../runtime/EventBus.js').EventBus|null} [eventBus]
   * @param {import('../packages/PackageReader.js').PackageReader|null} [packageReader]
   */
  constructor(eventBus = null, packageReader = null) {
    this._bus         = eventBus
    this._engine      = new AudioEngine()
    this._fft         = new FFTPipeline(eventBus)
    this._assetLoader = null    // created after audio starts (needs AudioContext)
    this._reader      = packageReader
    this._started     = false
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  /**
   * Start the audio engine and connect the FFT pipeline.
   * Must be called from a user-gesture handler (click, keydown, etc.).
   * Idempotent — safe to call multiple times.
   */
  async start() {
    if (this._started) return

    await this._engine.start()

    // Connect FFT tap after engine is up
    this._fft.connect(this._engine)

    // AudioContext is available now — build the asset loader
    const ctx = this._engine.audioContext
    if (ctx) {
      this._assetLoader = new AudioAssetLoader(ctx, this._reader)
    }

    this._started = true
  }

  // ── Per-frame ──────────────────────────────────────────────────────────────

  /** Call once per animation frame to update FFT analysis data. */
  update() { this._fft.update() }

  // ── Asset loading ──────────────────────────────────────────────────────────

  /**
   * Load an audio file and return a decoded AudioBuffer.
   * @param {string} path  package-relative path or URL
   * @returns {Promise<AudioBuffer>}
   */
  async loadSound(path) {
    if (!this._assetLoader) throw new Error('ArtlabAudio: call start() first')
    return this._assetLoader.load(path)
  }

  // ── Accessors ──────────────────────────────────────────────────────────────

  /** Latest FFT band data — { bass, mid, treble, amplitude } */
  get data() { return this._fft.data }

  /** The underlying AudioEngine instance */
  get engine() { return this._engine }

  /** The FFTPipeline instance */
  get fft() { return this._fft }

  /** The AudioAssetLoader (null before start()) */
  get assetLoader() { return this._assetLoader }

  /** Whether start() has completed successfully */
  get started() { return this._started }
}
