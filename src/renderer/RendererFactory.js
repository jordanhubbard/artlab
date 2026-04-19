/**
 * Create the appropriate renderer backend.
 * Prefers WebGPU when available; falls back to WebGL2.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {Object}            [options]
 * @returns {Promise<import('./IRenderer.js').IRenderer>}
 */
export async function createRenderer(canvas, options = {}) {
  if (navigator.gpu) {
    try {
      const { WebGPUBackend } = await import('./WebGPUBackend.js')
      const backend = new WebGPUBackend(canvas)
      await backend.init()
      console.info('[RendererFactory] Using WebGPU backend')
      return backend
    } catch (e) {
      console.warn('[RendererFactory] WebGPU init failed, falling back to WebGL2:', e.message)
    }
  }

  const { WebGL2Backend } = await import('./WebGL2Backend.js')
  const backend = new WebGL2Backend(canvas)
  console.info('[RendererFactory] Using WebGL2 backend')
  return backend
}
