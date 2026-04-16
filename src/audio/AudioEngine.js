/**
 * AudioEngine — wraps Tone.js for procedural space ambient music.
 * Must call start() from a user-gesture handler before audio plays.
 */
export class AudioEngine {
  constructor() {
    this.started   = false
    this._Tone     = null
    this.reverb    = null
    this.delay     = null
    this.limiter   = null
  }

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

      // Master volume
      this.master = new Tone.Volume(-6).connect(this.delay)

      this.started = true
      console.info('[audio] Tone.js started')
    } catch (e) {
      console.warn('[audio] Tone.js unavailable:', e.message)
    }
  }

  /** Tone.js module — safe getter (may be null if not started) */
  get Tone() { return this._Tone }

  /** Output node for connecting synths */
  get output() { return this.master ?? null }
}
