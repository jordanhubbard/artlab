/**
 * @interface IRenderer
 * Artlab renderer backend interface.
 * All methods are synchronous unless noted.
 */
export class IRenderer {
  /** @returns {HTMLCanvasElement} */
  get domElement() { throw new Error('not implemented') }

  /**
   * @param {Three.Scene} scene
   * @param {Three.Camera} camera
   */
  render(scene, camera) { throw new Error('not implemented') }

  /**
   * @param {number} w
   * @param {number} h
   */
  resize(w, h) { throw new Error('not implemented') }

  /**
   * @param {number} v  bloom strength 0–3
   */
  setBloomStrength(v) { throw new Error('not implemented') }

  /** @returns {{ isWebGPU: boolean, backend: string }} */
  get capabilities() { throw new Error('not implemented') }

  /**
   * @param {{ type: string, [key: string]: any }} desc
   */
  setPostProcessing(desc) { throw new Error('not implemented') }

  /**
   * Start the render loop.  The callback is invoked each frame with (time, xrFrame).
   * Pass null to stop the loop.
   *
   * @param {Function|null} callback
   */
  setAnimationLoop(callback) { throw new Error('not implemented') }

  dispose() { throw new Error('not implemented') }
}
