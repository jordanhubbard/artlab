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

  // ── Teardown ───────────────────────────────────────────────────────────────

  /**
   * Fully tear down the audio engine.
   * Disposes all Tone.js nodes, stops the Transport, closes the AudioContext,
   * then installs a fresh Tone.Context so the next scene starts clean.
   *
   * Call this before loading a new example / package.
   */
  async stop() {
    if (!this._Tone || !this.started) return
    const Tone = this._Tone

    // 1. Stop the Transport and clear any scheduled events.
    Tone.Transport.stop()
    Tone.Transport.cancel()

    // 2. Dispose master chain nodes (order: leaf → root).
    try { this.master?.dispose()  } catch (_) {}
    try { this.delay?.dispose()   } catch (_) {}
    try { this.reverb?.dispose()  } catch (_) {}
    try { this.limiter?.dispose() } catch (_) {}

    this.master  = null
    this.delay   = null
    this.reverb  = null
    this.limiter = null

    // 3. Close the AudioContext — the only call that truly frees OS resources.
    //    suspend() only pauses; close() is required for a real release.
    try {
      await Tone.context.close()
    } catch (_) {}

    // 4. Give Tone.js a fresh context so the next scene can call start() again.
    try {
      Tone.setContext(new Tone.Context())
    } catch (_) {}

    this.started = false
    console.info('[audio] AudioEngine stopped and context released')
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
