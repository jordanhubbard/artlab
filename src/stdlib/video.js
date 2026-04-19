/**
 * artlab/video — Video input, video textures, and canvas capture for the Artlab DSL
 *
 * DSL programs import this module via:
 *   use "artlab/video"
 *
 * Quick reference:
 *   webcam(opts)                 — live webcam VideoTexture
 *   screen(opts)                 — screen-capture VideoTexture
 *   videoTexture(src, opts)      — VideoTexture from a file URL or package path
 *   captureCanvas(canvas, opts)  — MediaRecorder-based canvas recording
 *   chromaKey(tex, color, t)     — ShaderMaterial: green-screen removal
 *   pixelate(tex, blockSize)     — ShaderMaterial: pixelated rendering
 *   glitch(tex, opts)            — ShaderMaterial: RGB-split / scanline glitch
 *   videoPlane(texOrResult, opts) — PlaneGeometry Mesh sized to video aspect ratio
 */

import * as THREE from 'three'

// ---------------------------------------------------------------------------
// Shared GLSL preamble — UV-based texture lookup used by all shader materials
// ---------------------------------------------------------------------------

const _VERT = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

// ---------------------------------------------------------------------------
// Webcam / media input
// ---------------------------------------------------------------------------

/**
 * Open a webcam stream and return a VideoTexture that becomes valid once isReady() is true.
 *
 * @param {object} [options]
 * @param {number} [options.width=1280]
 * @param {number} [options.height=720]
 * @param {'user'|'environment'} [options.facingMode='user']
 * @returns {{ texture: THREE.VideoTexture, video: HTMLVideoElement, start(): void, stop(): void, isReady(): boolean }}
 */
export function webcam(options = {}) {
  const { width = 1280, height = 720, facingMode = 'user' } = options
  return _mediaStream(
    () => navigator.mediaDevices.getUserMedia({
      video: { width, height, facingMode },
      audio: false,
    })
  )
}

/**
 * Capture the display (or a window / tab) and return a VideoTexture that becomes valid once isReady() is true.
 *
 * @param {object} [options]
 * @param {number} [options.width=1920]
 * @param {number} [options.height=1080]
 * @returns {{ texture: THREE.VideoTexture, video: HTMLVideoElement, start(): void, stop(): void, isReady(): boolean }}
 */
export function screen(options = {}) {
  const { width = 1920, height = 1080 } = options
  return _mediaStream(
    () => navigator.mediaDevices.getDisplayMedia({
      video: { width, height },
      audio: false,
    })
  )
}

// ---------------------------------------------------------------------------
// Video file playback
// ---------------------------------------------------------------------------

/**
 * Create a VideoTexture from a URL or package-relative path.
 *
 * @param {string} src                   URL or package-relative path
 * @param {object} [options]
 * @param {boolean} [options.autoplay=true]
 * @param {boolean} [options.loop=true]
 * @param {boolean} [options.muted=true]
 * @returns {{ texture: THREE.VideoTexture, video: HTMLVideoElement, play(): void, pause(): void, loop(bool): void, currentTime: number, duration: number }}
 */
export function videoTexture(src, options = {}) {
  const { autoplay = true, loop = true, muted = true } = options

  const video = document.createElement('video')
  video.src          = src
  video.loop         = loop
  video.muted        = muted
  video.playsInline  = true
  video.crossOrigin  = 'anonymous'

  const texture = new THREE.VideoTexture(video)
  texture.colorSpace = THREE.SRGBColorSpace

  if (autoplay) video.play()

  return {
    /** The underlying VideoTexture. */
    texture,
    /** The underlying HTMLVideoElement. */
    video,
    /** Resume playback. */
    play()      { video.play() },
    /** Pause playback. */
    pause()     { video.pause() },
    /**
     * Enable or disable looping.
     * @param {boolean} enabled
     */
    loop(enabled) { video.loop = enabled },
    /** Current playback position in seconds. */
    get currentTime() { return video.currentTime },
    set currentTime(t) { video.currentTime = t },
    /** Total duration in seconds (NaN until metadata loads). */
    get duration() { return video.duration },
  }
}

// ---------------------------------------------------------------------------
// Canvas capture / recording
// ---------------------------------------------------------------------------

/**
 * Record a canvas element to a WebM file using MediaRecorder.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {object} [options]
 * @param {number} [options.fps=30]
 * @param {string} [options.mimeType='video/webm']
 * @returns {{ start(): void, stop(): void, download(filename?: string): void }}
 */
export function captureCanvas(canvas, options = {}) {
  const { fps = 30, mimeType = 'video/webm' } = options

  let _recorder  = null
  let _chunks    = []

  return {
    /** Begin recording. */
    start() {
      _chunks = []
      const stream   = canvas.captureStream(fps)
      _recorder      = new MediaRecorder(stream, { mimeType })
      _recorder.ondataavailable = e => { if (e.data.size > 0) _chunks.push(e.data) }
      _recorder.start()
    },

    /** Stop recording; the recorded data is available for download() immediately after. */
    stop() {
      if (_recorder && _recorder.state !== 'inactive') _recorder.stop()
    },

    /**
     * Trigger a browser download of the recorded video.
     * Call after stop() — or pass a callback if you need to wait for the
     * onstop event; in practice the chunks are already flushed by the time
     * JS resumes after stop().
     *
     * @param {string} [filename='capture.webm']
     */
    download(filename = 'capture.webm') {
      const blob = new Blob(_chunks, { type: mimeType })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    },
  }
}

// ---------------------------------------------------------------------------
// Post-processing shader materials
// ---------------------------------------------------------------------------

/**
 * ShaderMaterial that removes a chroma key color from a video texture (green-screen).
 *
 * @param {THREE.Texture} texture     Source video (or any) texture
 * @param {THREE.Color}   keyColor    Color to key out
 * @param {number}        threshold   Similarity threshold in [0, 1] (default 0.3)
 * @returns {THREE.ShaderMaterial}
 */
export function chromaKey(texture, keyColor = new THREE.Color(0, 1, 0), threshold = 0.3) {
  return new THREE.ShaderMaterial({
    uniforms: {
      map:       { value: texture },
      keyColor:  { value: keyColor },
      threshold: { value: threshold },
    },
    vertexShader: _VERT,
    fragmentShader: /* glsl */`
      uniform sampler2D map;
      uniform vec3      keyColor;
      uniform float     threshold;
      varying vec2      vUv;

      void main() {
        vec4  col  = texture2D(map, vUv);
        float diff = length(col.rgb - keyColor);
        if (diff < threshold) discard;
        gl_FragColor = col;
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
  })
}

/**
 * ShaderMaterial that renders a texture pixelated at a given block size.
 *
 * @param {THREE.Texture} texture    Source video (or any) texture
 * @param {number}        blockSize  Pixel block size in texels (default 8)
 * @returns {THREE.ShaderMaterial}
 */
export function pixelate(texture, blockSize = 8) {
  return new THREE.ShaderMaterial({
    uniforms: {
      map:       { value: texture },
      blockSize: { value: blockSize },
      resolution: {
        value: new THREE.Vector2(
          texture.image?.videoWidth  ?? texture.image?.width  ?? 1280,
          texture.image?.videoHeight ?? texture.image?.height ?? 720,
        ),
      },
    },
    vertexShader: _VERT,
    fragmentShader: /* glsl */`
      uniform sampler2D map;
      uniform float     blockSize;
      uniform vec2      resolution;
      varying vec2      vUv;

      void main() {
        vec2 texel  = vUv * resolution;
        vec2 snapped = (floor(texel / blockSize) * blockSize + blockSize * 0.5) / resolution;
        gl_FragColor = texture2D(map, snapped);
      }
    `,
    side: THREE.DoubleSide,
  })
}

/**
 * ShaderMaterial with an RGB-split and scanline glitch effect.
 *
 * @param {THREE.Texture} texture
 * @param {object} [options]
 * @param {number} [options.intensity=0.01]  RGB channel separation amount (UV units)
 * @param {number} [options.speed=1.0]       Scanline animation speed multiplier
 * @returns {THREE.ShaderMaterial}
 */
export function glitch(texture, options = {}) {
  const { intensity = 0.01, speed = 1.0 } = options

  return new THREE.ShaderMaterial({
    uniforms: {
      map:       { value: texture },
      intensity: { value: intensity },
      speed:     { value: speed },
      time:      { value: 0 },
    },
    vertexShader: _VERT,
    fragmentShader: /* glsl */`
      uniform sampler2D map;
      uniform float     intensity;
      uniform float     speed;
      uniform float     time;
      varying vec2      vUv;

      float rand(vec2 co) {
        return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
      }

      void main() {
        float t      = time * speed;
        float shift  = rand(vec2(floor(vUv.y * 40.0 + t * 3.0), t)) * intensity;
        shift       *= step(0.92, rand(vec2(floor(vUv.y * 8.0), t)));

        float r = texture2D(map, vUv + vec2( shift, 0.0)).r;
        float g = texture2D(map, vUv).g;
        float b = texture2D(map, vUv - vec2( shift, 0.0)).b;
        float a = texture2D(map, vUv).a;

        // Scanline darkening
        float scan = 0.85 + 0.15 * sin(vUv.y * 800.0 - t * 20.0);

        gl_FragColor = vec4(vec3(r, g, b) * scan, a);
      }
    `,
    side: THREE.DoubleSide,
  })
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/**
 * Create a PlaneGeometry mesh sized to the correct aspect ratio of a video texture.
 *
 * Accepts either a raw THREE.VideoTexture or the result objects returned by
 * webcam(), screen(), and videoTexture().
 *
 * @param {THREE.VideoTexture|{ texture: THREE.VideoTexture, video: HTMLVideoElement }} textureOrResult
 * @param {object} [options]
 * @param {number} [options.width=2]       Desired display width in scene units
 * @param {number} [options.height]        If omitted, derived from video aspect ratio
 * @param {THREE.Material} [options.material]  Override material (defaults to MeshBasicMaterial)
 * @returns {THREE.Mesh}
 */
export function videoPlane(textureOrResult, options = {}) {
  const texture = textureOrResult?.texture ?? textureOrResult
  const video   = textureOrResult?.video   ?? texture?.image

  let { width = 2, height, material } = options

  if (height === undefined) {
    const vw = video?.videoWidth  ?? video?.width  ?? 16
    const vh = video?.videoHeight ?? video?.height ?? 9
    height = (vh / vw) * width
  }

  const geo = new THREE.PlaneGeometry(width, height)
  const mat = material ?? new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide })

  return new THREE.Mesh(geo, mat)
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Shared factory for getUserMedia / getDisplayMedia streams.
 * Returns the same handle shape as webcam() / screen().
 *
 * @param {() => Promise<MediaStream>} acquireFn
 * @returns {{ texture: THREE.VideoTexture, video: HTMLVideoElement, start(): void, stop(): void, isReady(): boolean }}
 */
function _mediaStream(acquireFn) {
  const video = document.createElement('video')
  video.playsInline = true
  video.muted       = true
  video.autoplay    = true

  const texture = new THREE.VideoTexture(video)
  texture.colorSpace = THREE.SRGBColorSpace

  let _stream = null
  let _ready  = false

  // Kick off acquisition immediately — non-blocking.
  acquireFn().then(stream => {
    _stream    = stream
    video.srcObject = stream
    return video.play()
  }).then(() => {
    _ready = true
  })

  return {
    /** The VideoTexture (valid once isReady() returns true). */
    texture,
    /** The underlying HTMLVideoElement. */
    video,

    /** Re-acquire the stream after stop(), or begin playback if not already started. */
    start() {
      if (_stream) { video.play(); return }
      acquireFn().then(stream => {
        _stream         = stream
        video.srcObject = stream
        return video.play()
      }).then(() => { _ready = true })
    },

    /** Stop all media tracks and release the stream. */
    stop() {
      _ready = false
      if (_stream) {
        for (const track of _stream.getTracks()) track.stop()
        _stream = null
      }
      video.srcObject = null
    },

    /** True once the video element is playing and the texture is usable. */
    isReady() { return _ready },
  }
}
