/** Gesture-started microphone analysis, with silent output and safe late permission cleanup. */
export class MicrophoneInput {
  constructor({ fftSize = 256, smoothing = 0.78, mediaDevices, AudioContext } = {}) {
    this.fftSize = fftSize
    this.smoothing = smoothing
    this._mediaDevices = mediaDevices
    this._AudioContext = AudioContext
    this.disposed = false
    this.active = false
  }

  start() {
    if (this.disposed) return Promise.reject(new Error('Microphone input is disposed'))
    if (!this._starting) this._starting = this._start().catch(error => {
      this._starting = null
      throw error
    })
    return this._starting
  }

  async _start() {
    const AudioContext = this._AudioContext ?? globalThis.AudioContext ?? globalThis.webkitAudioContext
    const devices = this._mediaDevices ?? globalThis.navigator?.mediaDevices
    if (!AudioContext || !devices?.getUserMedia) throw new Error('Microphone input is unavailable')
    const context = this.context = new AudioContext()
    try {
      // Resume while the click still grants audio activation.
      const resumed = context.resume()
      const requested = devices.getUserMedia({ audio: true, video: false }).then(stream => {
        if (this.disposed) stream.getTracks().forEach(track => track.stop())
        else this.stream = stream
        return stream
      })
      const [resumeResult, streamResult] = await Promise.allSettled([resumed, requested])
      if (resumeResult.status === 'rejected') throw resumeResult.reason
      if (streamResult.status === 'rejected') throw streamResult.reason
      if (this.disposed) return
      this.source = context.createMediaStreamSource(this.stream)
      this.analyser = context.createAnalyser()
      this.analyser.fftSize = this.fftSize
      this.analyser.smoothingTimeConstant = this.smoothing
      this.silent = context.createGain()
      this.silent.gain.value = 0
      this.source.connect(this.analyser)
      this.analyser.connect(this.silent)
      this.silent.connect(context.destination)
      this.data = new Uint8Array(this.analyser.frequencyBinCount)
      this.active = true
    } catch (error) {
      await this._close()
      throw error
    }
  }

  update() { if (this.active) this.analyser.getByteFrequencyData(this.data) }

  level(lo = 0, hi = 1) {
    if (!this.active) return 0
    const first = Math.max(0, Math.floor(lo * this.data.length))
    const last = Math.min(this.data.length, Math.ceil(hi * this.data.length))
    if (last <= first) return 0
    let sum = 0
    for (let i = first; i < last; i++) sum += this.data[i]
    return sum / ((last - first) * 255)
  }

  async _close() {
    this.active = false
    this.stream?.getTracks().forEach(track => track.stop())
    this.stream = null
    for (const node of [this.source, this.analyser, this.silent]) node?.disconnect()
    if (this.context && this.context.state !== 'closed') await this.context.close()
  }

  dispose() {
    if (this.disposed) return this._closing
    this.disposed = true
    this._closing = this._close()
    return this._closing
  }
}
