/**
 * FFTPipeline — reads real-time FFT from Tone.js and exposes
 * frequency band data to shader uniforms and an optional EventBus.
 *
 * Backward-compatible API:
 *   const fft = new FFTPipeline()          // or new FFTPipeline(eventBus)
 *   fft.connect(audioEngine)
 *   fft.update()                           // call each frame
 *   fft.data  → { bass, mid, treble, amplitude }
 *
 * With EventBus, each frame emits:
 *   'audio:fft'   → { bass, mid, high, data }       (every frame)
 *   'audio:beat'  → { band, strength }              (on beat detection)
 */
export class FFTPipeline {
  /**
   * @param {import('../runtime/EventBus.js').EventBus|null} [eventBus]
   */
  constructor(eventBus = null) {
    this._fft    = null
    this._meter  = null
    this._bus    = eventBus
    this.data    = { bass: 0, mid: 0, treble: 0, amplitude: 0 }

    // Beat detection state
    this._beatThreshold = 0.35        // linear energy level that triggers a beat
    this._beatCooldown  = 0           // frames remaining before next beat can fire
    this._beatCooldownFrames = 8      // minimum frames between beat events (~133 ms @ 60 fps)
    this._prevBass      = 0
    this._prevMid       = 0
  }

  // ── Connection ─────────────────────────────────────────────────────────────

  /**
   * Connect FFT and Meter nodes to Tone.js destination.
   * Must be called after AudioEngine.start() (i.e. after user gesture).
   * @param {import('./AudioEngine.js').AudioEngine} audioEngine
   */
  connect(audioEngine) {
    if (!audioEngine.started) return
    const Tone = audioEngine.Tone
    if (!Tone) return

    try {
      this._fft   = new Tone.FFT(512)
      this._meter = new Tone.Meter()
      Tone.getDestination().connect(this._fft)
      Tone.getDestination().connect(this._meter)
      console.info('[audio] FFTPipeline connected')
    } catch (e) {
      console.warn('[audio] FFTPipeline failed:', e.message)
    }
  }

  /**
   * Route an additional audio source (e.g. Tone.UserMedia) into the FFT
   * analyzer without sending it to the speakers. Safe to call after connect().
   * @param {any} toneNode — any Tone.js node with .connect()
   */
  connectInput(toneNode) {
    if (!this._fft || !toneNode) return
    try {
      toneNode.connect(this._fft)
      toneNode.connect(this._meter)
      console.info('[audio] FFTPipeline input source connected')
    } catch (e) {
      console.warn('[audio] FFTPipeline.connectInput failed:', e.message)
    }
  }

  // ── Per-frame update ───────────────────────────────────────────────────────

  /**
   * Analyse the latest FFT frame. Call once per animation frame.
   * Updates this.data and, if an EventBus was provided, emits events.
   */
  update() {
    if (!this._fft) return

    try {
      const values = this._fft.getValue()   // Float32Array of dB values

      // Convert dB → linear (0..1), then average frequency bands.
      // 512 bins, Nyquist ~22050 Hz → each bin ≈ 43 Hz
      const toLinear = (db) => Math.pow(10, Math.max(-100, db) / 20)

      // Bass: bins 0–5   (~0–215 Hz)
      let bass = 0
      for (let i = 0; i < 6; i++) bass += toLinear(values[i])
      this.data.bass = Math.min(1, bass / 6)

      // Mid: bins 6–89  (~260–3870 Hz)
      let mid = 0
      for (let i = 6; i < 90; i++) mid += toLinear(values[i])
      this.data.mid = Math.min(1, mid / 84)

      // Treble / high: bins 90–511
      let treble = 0
      for (let i = 90; i < 512; i++) treble += toLinear(values[i])
      this.data.treble = Math.min(1, treble / 422)

      const amp = this._meter.getValue()
      this.data.amplitude = typeof amp === 'number' ? Math.pow(10, amp / 20) : 0

      if (this._bus) {
        this._emitFFT(values)
        this._detectBeats()
      }
    } catch (_) {
      // Meter not yet populated — ignore
    }
  }

  // ── Teardown ───────────────────────────────────────────────────────────────

  /**
   * Disconnect and dispose FFT and Meter nodes.
   * Call this before stopping the AudioEngine so the nodes are released
   * before the AudioContext is closed.
   */
  dispose() {
    try { this._fft?.dispose()   } catch (_) {}
    try { this._meter?.dispose() } catch (_) {}
    this._fft   = null
    this._meter = null
    this.data   = { bass: 0, mid: 0, treble: 0, amplitude: 0 }
    console.info('[audio] FFTPipeline disposed')
  }

  // ── EventBus integration ───────────────────────────────────────────────────

  _emitFFT(rawData) {
    this._bus.emit('audio:fft', {
      bass:      this.data.bass,
      mid:       this.data.mid,
      high:      this.data.treble,    // 'high' alias for external consumers
      data:      rawData,
    })
  }

  _detectBeats() {
    if (this._beatCooldown > 0) {
      this._beatCooldown--
      this._prevBass = this.data.bass
      this._prevMid  = this.data.mid
      return
    }

    const bassRise = this.data.bass - this._prevBass
    const midRise  = this.data.mid  - this._prevMid

    if (this.data.bass > this._beatThreshold && bassRise > 0.05) {
      this._bus.emit('audio:beat', { band: 'bass', strength: this.data.bass })
      this._beatCooldown = this._beatCooldownFrames
    } else if (this.data.mid > this._beatThreshold && midRise > 0.04) {
      this._bus.emit('audio:beat', { band: 'mid',  strength: this.data.mid })
      this._beatCooldown = this._beatCooldownFrames
    }

    this._prevBass = this.data.bass
    this._prevMid  = this.data.mid
  }
}
