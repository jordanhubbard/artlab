import type * as Three from 'three'
export interface BloomSettings { type: 'bloom'; strength?: number; radius?: number; threshold?: number }
export interface RendererCapabilities { isWebGPU: boolean; backend: string }
export type AnimationLoop = ((time: number, frame?: XRFrame) => void) | null
/**
 * @interface IRenderer
 * Artlab renderer backend interface.
 * All methods are synchronous unless noted.
 */
export class IRenderer {
  /** @returns {HTMLCanvasElement} */
  get domElement(): HTMLCanvasElement { throw new Error('not implemented') }

  /**
   * @param {Three.Scene} scene
   * @param {Three.Camera} camera
   */
  render(scene: Three.Scene, camera: Three.Camera): void { throw new Error('not implemented') }

  /**
   * @param {number} w
   * @param {number} h
   */
  resize(w: number, h: number): void { throw new Error('not implemented') }

  /**
   * @param {number} v  bloom strength 0–3
   */
  setBloomStrength(v: number): void { throw new Error('not implemented') }

  /** @returns {{ isWebGPU: boolean, backend: string }} */
  get capabilities(): RendererCapabilities { throw new Error('not implemented') }

  /**
   * @param {{ type: string, [key: string]: any }} desc
   */
  setPostProcessing(desc: BloomSettings): void { throw new Error('not implemented') }

  /**
   * Start the render loop.  The callback is invoked each frame with (time, xrFrame).
   * Pass null to stop the loop.
   *
   * @param {Function|null} callback
   */
  setAnimationLoop(callback: AnimationLoop): void { throw new Error('not implemented') }

  dispose(): void { throw new Error('not implemented') }
}
