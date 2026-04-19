/**
 * AudioEngine — wraps Tone.js for procedural space ambient music.
 * Must call start() from a user-gesture handler before audio plays.
 *
 * Supports both singleton usage (AudioEngine.getInstance()) and direct
 * constructor instantiation — both work identically.
 */
export class AudioEngine {
  constructor() {
    this.started   = false
    this._Tone     = null
    this.reverb    = null
    this.delay     = null
    this.limiter   = null
    this.master    = null
  }

  // ── Singleton ──────────────────────────────────────────────────────────────

  static getInstance() {
    if (!AudioEngine._instance) {
      AudioEngine._instance = new AudioEngine()
    }
    return AudioEngine._instance
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  async start() {
    if (this.started) return

    try {
      const Tone = await import('tone')
      this._Tone = Tone

      await Tone.start()
      Tone.getContext().latencyHint = 'playback'

      // Master chain: pad → delay → reverb → limiter → out
      this.limiter = new Tone.Limiter(-3).toDestination()
      this.reverb  = new Tone.Reverb({ decay: 10.0, wet: 0.55 }).connect(this.limiter)
      this.delay   = new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.35, wet: 0.25 }).connect(this.reverb)

      // Master volume — synths and pads connect here
      this.master = new Tone.Volume(-6).connect(this.delay)

      this.started = true
      console.info('[audio] Tone.js started')
    } catch (e) {
      console.warn('[audio] Tone.js unavailable:', e.message)
    }
  }

  // ── Accessors ──────────────────────────────────────────────────────────────

  /** Tone.js module reference — may be null before start() */
  get Tone() { return this._Tone }

  /** Output node for connecting synths (alias kept for SynthPads compatibility) */
  get output() { return this.master ?? null }

  /** Master gain/volume node */
  get masterGain() { return this.master ?? null }

  /**
   * Raw Web Audio AudioContext from Tone.js.
   * Available after start() resolves.
   * Required by AudioAssetLoader and ArtlabAudio.
   * @returns {AudioContext|null}
   */
  get audioContext() {
    if (!this._Tone) return null
    try {
      return this._Tone.getContext().rawContext
    } catch (_) {
      return null
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Create a Web Audio BufferSource connected to master.
   * Useful for one-shot audio playback outside of Tone.js.
   *
   * @param {AudioBuffer} buffer
   * @returns {AudioBufferSourceNode|null}  null if not yet started
   */
  createSource(buffer) {
    const ctx = this.audioContext
    if (!ctx) return null

    const source = ctx.createBufferSource()
    source.buffer = buffer

    // Connect into the Tone.js destination so master chain applies
    const dest = this._Tone?.getDestination()?.input ?? ctx.destination
    source.connect(dest)

    return source
  }
}
