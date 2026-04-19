/**
 * AudioAssetLoader — fetches audio files and decodes them to AudioBuffers.
 *
 * Works with raw Web Audio API (AudioContext), not Tone.js, so it is
 * independent of the Tone.js lifecycle.  Requires an AudioContext that
 * has been resumed (i.e. after a user gesture — AudioEngine.start() ensures
 * this before ArtlabAudio creates an instance).
 *
 * Supports loading from a PackageReader (zip) or directly from a URL.
 */
export class AudioAssetLoader {
  constructor(audioContext, packageReader = null) {
    this._ctx    = audioContext
    this._reader = packageReader
    this._cache  = new Map()   // path → AudioBuffer
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  /**
   * Load an audio file and decode it to an AudioBuffer.
   * Subsequent calls with the same path return the cached buffer.
   *
   * @param {string} path  package-relative path or URL
   * @returns {Promise<AudioBuffer>}
   */
  async load(path) {
    if (this._cache.has(path)) return this._cache.get(path)

    let arrayBuffer
    if (this._reader) {
      const blob = await this._reader.readAsset(path)
      arrayBuffer = await blob.arrayBuffer()
    } else {
      const resp = await fetch(path)
      if (!resp.ok) throw new Error(`AudioAssetLoader: failed to load "${path}" (HTTP ${resp.status})`)
      arrayBuffer = await resp.arrayBuffer()
    }

    const buffer = await this._ctx.decodeAudioData(arrayBuffer)
    this._cache.set(path, buffer)
    return buffer
  }

  // ── Playback ───────────────────────────────────────────────────────────────

  /**
   * Play an AudioBuffer once (fire-and-forget).
   * Returns the AudioBufferSourceNode so callers can stop it early if needed.
   *
   * @param {AudioBuffer} buffer
   * @param {AudioNode|null} [destination]  defaults to AudioContext.destination
   * @param {object} [opts]
   * @param {number} [opts.volume=1]    linear gain (0..1+)
   * @param {number} [opts.detune=0]    cents
   * @param {number} [opts.offset=0]    start offset in seconds
   * @param {boolean} [opts.loop=false]
   * @returns {AudioBufferSourceNode}
   */
  playOnce(buffer, destination = null, { volume = 1, detune = 0, offset = 0, loop = false } = {}) {
    const source = this._ctx.createBufferSource()
    const gain   = this._ctx.createGain()

    source.buffer       = buffer
    source.detune.value = detune
    source.loop         = loop

    gain.gain.value = volume

    source.connect(gain)
    gain.connect(destination ?? this._ctx.destination)
    source.start(0, offset)

    return source
  }

  // ── Cache management ───────────────────────────────────────────────────────

  /** Remove a single cached buffer. */
  evict(path) { this._cache.delete(path) }

  /** Clear the entire cache. */
  clear() { this._cache.clear() }
}
