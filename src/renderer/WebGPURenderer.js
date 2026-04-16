import * as THREE from 'three'

/**
 * Creates the best available renderer for this platform.
 * Tries WebGPU (→ Metal on macOS Apple Silicon) first,
 * falls back to WebGL2 with ACESFilmic tone-mapping.
 */
export async function createRenderer(canvas) {
  let renderer
  let isWebGPU = false

  // Try WebGPU first (Metal on macOS Apple Silicon)
  // WebGPURenderer in Three.js 0.170 supports ShaderMaterial via GLSL→WGSL transpilation.
  // We use forceWebGL fallback if navigator.gpu is unavailable.
  try {
    const mod = await import('three/webgpu')
    const WebGPURendererClass = mod.WebGPURenderer ?? mod.default

    if (WebGPURendererClass) {
      const gpuAvailable = typeof navigator !== 'undefined' && 'gpu' in navigator
      renderer = new WebGPURendererClass({
        canvas,
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
        forceWebGL: !gpuAvailable,
      })
      await renderer.init()
      isWebGPU = gpuAvailable && renderer.isWebGPURenderer === true
      console.info('[renderer] WebGPURenderer init OK, isWebGPU:', isWebGPU)
    }
  } catch (e) {
    console.info('[renderer] WebGPU init failed, falling back to WebGL2:', e.message)
  }

  // Fall back to standard WebGL2
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    })
    console.info('[renderer] Using WebGL2 renderer')
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.1
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  // Update badge
  const badge = document.getElementById('webgpu-badge')
  if (badge) {
    badge.textContent = isWebGPU ? '▸ WebGPU · Metal' : '▸ WebGL2'
    badge.style.color = isWebGPU ? 'rgba(100, 255, 150, 0.5)' : 'rgba(255, 200, 100, 0.4)'
  }

  return { renderer, isWebGPU }
}
