import type { IRenderer } from './IRenderer.ts'
/**
 * Create the appropriate renderer backend.
 * Prefers WebGPU when available; falls back to WebGL2.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {Object}            [options]
 * @returns {Promise<import('./IRenderer.ts').IRenderer>}
 */
export async function createRenderer(canvas: HTMLCanvasElement, options: Record<string, unknown> = {}): Promise<IRenderer> {
  if (navigator.gpu) {
    try {
      const { WebGPUBackend } = await import('./WebGPUBackend.ts')
      const backend = new WebGPUBackend(canvas)
      await backend.init()
      console.info('[RendererFactory] Using WebGPU backend')
      return backend
    } catch (e) {
      console.warn('[RendererFactory] WebGPU init failed, falling back to WebGL2:', e instanceof Error ? e.message : String(e))
    }
  }

  const { WebGL2Backend } = await import('./WebGL2Backend.ts')
  const backend = new WebGL2Backend(canvas)
  console.info('[RendererFactory] Using WebGL2 backend')
  return backend
}
