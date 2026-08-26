import * as Three from 'three'

const SAMPLE_WIDTH = 32
const SAMPLE_HEIGHT = 24
const SAMPLE_INTERVAL = 1 / 15

export function createMediaInput(options = {}) {
  return new MediaInput(options)
}

class MediaInput {
  constructor({
    mediaDevices = globalThis.navigator?.mediaDevices,
    createAudioContext = defaultAudioContext,
    documentRef = globalThis.document,
  } = {}) {
    this._mediaDevices = mediaDevices
    this._createAudioContext = createAudioContext
    this._document = documentRef
    this._cameraStream = null
    this._microphoneStream = null
    this._audioContext = null
    this._microphoneSource = null
    this._analyser = null
    this._silentGain = null
    this._sampleContext = null
    this._previousLuminance = new Float32Array(SAMPLE_WIDTH * SAMPLE_HEIGHT)
    this._waveform = new Float32Array(256)
    this._lastSampleAt = -Infinity
    this._startPromise = null
    this._disposed = false

    this.cameraStatus = 'idle'
    this.microphoneStatus = 'idle'
    this.motion = { x: 0, y: 0, amount: 0 }
    this.micEnergy = 0
    this.video = this._createVideo()
    this.texture = createFallbackTexture()
    this._sampleCanvas = this._createSampleCanvas()
  }

  start() {
    if (this._disposed) return Promise.resolve()
    if (!this._startPromise) {
      this._startPromise = Promise.all([
        this._startCamera(),
        this._startMicrophone(),
      ]).then(() => undefined)
    }
    return this._startPromise
  }

  update(elapsed) {
    this._sampleMicrophone()
    if (elapsed - this._lastSampleAt >= SAMPLE_INTERVAL) {
      this._lastSampleAt = elapsed
      this._sampleMotion()
    }
  }

  async dispose() {
    if (this._disposed) return
    this._disposed = true
    stopStream(this._cameraStream)
    stopStream(this._microphoneStream)
    this._cameraStream = null
    this._microphoneStream = null
    this._microphoneSource?.disconnect()
    this._analyser?.disconnect()
    this._silentGain?.disconnect()
    this._microphoneSource = null
    this._analyser = null
    this._silentGain = null
    if (this._audioContext) await this._audioContext.close()
    this._audioContext = null
    this.video.srcObject = null
    this.texture.dispose?.()
  }

  async _startCamera() {
    if (!this._mediaDevices?.getUserMedia) {
      this.cameraStatus = 'unavailable'
      return
    }
    this.cameraStatus = 'requesting'
    try {
      const stream = await this._mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false,
      })
      if (this._disposed) {
        stopStream(stream)
        this.cameraStatus = 'stopped'
        return
      }
      this._cameraStream = stream
      this.video.srcObject = stream
      await this.video.play?.()
      if (this._disposed) {
        stopStream(stream)
        this._cameraStream = null
        this.video.srcObject = null
        this.cameraStatus = 'stopped'
        return
      }
      this.texture.dispose?.()
      this.texture = new Three.VideoTexture(this.video)
      this.texture.colorSpace = Three.SRGBColorSpace
      this.texture.minFilter = Three.LinearFilter
      this.texture.magFilter = Three.LinearFilter
      this.cameraStatus = 'active'
    } catch (error) {
      stopStream(this._cameraStream)
      this._cameraStream = null
      this.video.srcObject = null
      this.cameraStatus = this._disposed ? 'stopped' : permissionStatus(error)
    }
  }

  async _startMicrophone() {
    if (!this._mediaDevices?.getUserMedia) {
      this.microphoneStatus = 'unavailable'
      return
    }
    this.microphoneStatus = 'requesting'
    try {
      this._audioContext = this._createAudioContext?.()
      if (!this._audioContext) {
        this.microphoneStatus = 'unavailable'
        return
      }
      // Both calls begin synchronously inside the click handler. Awaiting the
      // permission prompt before creating/resuming the context loses Chrome's
      // transient user activation.
      const resumePromise = Promise.resolve(this._audioContext.resume?.())
      const streamPromise = this._mediaDevices.getUserMedia({
        video: false,
        audio: true,
      })
      const [resumeResult, streamResult] = await Promise.allSettled([
        resumePromise,
        streamPromise,
      ])
      if (streamResult.status === 'rejected') {
        this.microphoneStatus = this._disposed
          ? 'stopped'
          : permissionStatus(streamResult.reason)
        return
      }

      const stream = streamResult.value
      if (this._disposed || resumeResult.status === 'rejected') {
        stopStream(stream)
        this.microphoneStatus = this._disposed ? 'stopped' : 'unavailable'
        return
      }
      this._microphoneStream = stream
      this._buildMicrophoneGraph()
      this._microphoneSource = this._audioContext.createMediaStreamSource(stream)
      this._microphoneSource.connect(this._analyser)
      this.microphoneStatus = 'active'
    } catch (error) {
      stopStream(this._microphoneStream)
      this._microphoneStream = null
      this.microphoneStatus = this._disposed ? 'stopped' : permissionStatus(error)
    }
  }

  _buildMicrophoneGraph() {
    this._analyser = this._audioContext.createAnalyser()
    this._analyser.fftSize = 256
    this._analyser.smoothingTimeConstant = 0.78
    this._silentGain = this._audioContext.createGain()
    if (this._silentGain.gain?.setValueAtTime) {
      this._silentGain.gain.setValueAtTime(0, this._audioContext.currentTime ?? 0)
    } else if (this._silentGain.gain) {
      this._silentGain.gain.value = 0
    }
    this._analyser.connect(this._silentGain)
    this._silentGain.connect(this._audioContext.destination)
  }

  _createVideo() {
    const video = this._document?.createElement?.('video') ?? {}
    video.autoplay = true
    video.muted = true
    video.playsInline = true
    return video
  }

  _createSampleCanvas() {
    const canvas = this._document?.createElement?.('canvas')
    if (!canvas) return null
    canvas.width = SAMPLE_WIDTH
    canvas.height = SAMPLE_HEIGHT
    try {
      this._sampleContext = canvas.getContext('2d', { willReadFrequently: true })
    } catch {
      this._sampleContext = null
    }
    return canvas
  }

  _sampleMicrophone() {
    if (!this._analyser) {
      this.micEnergy *= 0.9
      return
    }
    this._analyser.getFloatTimeDomainData(this._waveform)
    let sum = 0
    for (const sample of this._waveform) sum += sample * sample
    this.micEnergy = clamp(Math.sqrt(sum / this._waveform.length), 0, 1)
  }

  _sampleMotion() {
    if (!this._sampleContext || !this.video.videoWidth) {
      this.motion.x *= 0.85
      this.motion.y *= 0.85
      this.motion.amount *= 0.85
      return
    }

    this._sampleContext.drawImage(this.video, 0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT)
    const pixels = this._sampleContext.getImageData(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT).data
    let weightedX = 0
    let weightedY = 0
    let total = 0

    for (let i = 0; i < this._previousLuminance.length; i++) {
      const pixel = i * 4
      const luminance = (pixels[pixel] + pixels[pixel + 1] + pixels[pixel + 2]) / 765
      const delta = Math.abs(luminance - this._previousLuminance[i])
      this._previousLuminance[i] = luminance
      const x = (i % SAMPLE_WIDTH) / (SAMPLE_WIDTH - 1) * 2 - 1
      const y = Math.floor(i / SAMPLE_WIDTH) / (SAMPLE_HEIGHT - 1) * 2 - 1
      weightedX += x * delta
      weightedY += y * delta
      total += delta
    }

    const targetX = total > 0.01 ? weightedX / total : 0
    const targetY = total > 0.01 ? -weightedY / total : 0
    this.motion.x = clamp(this.motion.x * 0.7 + targetX * 0.3, -1, 1)
    this.motion.y = clamp(this.motion.y * 0.7 + targetY * 0.3, -1, 1)
    this.motion.amount = clamp(total / this._previousLuminance.length * 8, 0, 1)
  }
}

function createFallbackTexture() {
  const size = 16
  const data = new Uint8Array(size * size * 4)
  for (let i = 0; i < size * size; i++) {
    const phase = (i * 29) % 255
    data[i * 4] = 70 + phase * 0.25
    data[i * 4 + 1] = 120 + phase * 0.35
    data[i * 4 + 2] = 145 + phase * 0.4
    data[i * 4 + 3] = 255
  }
  const texture = new Three.DataTexture(data, size, size, Three.RGBAFormat)
  texture.needsUpdate = true
  return texture
}

function defaultAudioContext() {
  const AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext
  return AudioContextClass ? new AudioContextClass() : null
}

function stopStream(stream) {
  for (const track of stream?.getTracks?.() ?? []) track.stop()
}

function permissionStatus(error) {
  return error?.name === 'NotAllowedError' ? 'denied' : 'unavailable'
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}
