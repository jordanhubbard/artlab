/**
 * Legacy entry-point kept for backward compatibility with main.js.
 *
 * The actual renderer is now created by RendererFactory → WebGL2Backend.
 * This wrapper preserves the original call signature:
 *
 *   const { renderer, isWebGPU } = await createRenderer(canvas)
 *
 * where `renderer` is now an IRenderer-conformant WebGL2Backend instance
 * that also exposes the raw WebGLRenderer as `renderer._renderer` when
 * legacy code needs it (e.g. PostProcessor).
 */
import { createRenderer as _createRendererBackend } from './RendererFactory.js'

export async function createRenderer(canvas) {
  const backend = await _createRendererBackend(canvas)
  return {
    renderer:  backend,
    isWebGPU:  backend.capabilities.isWebGPU,
  }
}
