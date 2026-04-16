/**
 * FFTPipeline — reads real-time FFT from Tone.js and exposes
 * frequency band data to shader uniforms.
 */
export class FFTPipeline {
  constructor() {
    this._fft   = null
    this._meter = null
    this.data   = { bass: 0, mid: 0, treble: 0, amplitude: 0 }
  }

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

  update() {
    if (!this._fft) return

    try {
      const values = this._fft.getValue()   // Float32Array of dB values

      // Convert dB → linear (0..1), then average frequency bands
      // 512 bins, Nyquist ~22050 Hz → each bin ≈ 43 Hz
      const toLinear = (db) => Math.pow(10, Math.max(-100, db) / 20)

      // Bass: bins 0-5  (~0–215 Hz)
      let bass = 0
      for (let i = 0; i < 6; i++) bass += toLinear(values[i])
      this.data.bass = Math.min(1, bass / 6)

      // Mid: bins 6-90  (~260–3870 Hz)
      let mid = 0
      for (let i = 6; i < 90; i++) mid += toLinear(values[i])
      this.data.mid = Math.min(1, mid / 84)

      // Treble: bins 90-512
      let treble = 0
      for (let i = 90; i < 512; i++) treble += toLinear(values[i])
      this.data.treble = Math.min(1, treble / 422)

      const amp = this._meter.getValue()
      this.data.amplitude = typeof amp === 'number' ? Math.pow(10, amp / 20) : 0
    } catch (_) {
      // Meter not yet populated — ignore
    }
  }
}
