/**
 * Shared Playwright helpers for Artlab e2e tests.
 */

// Console messages that are expected / harmless in a headless environment.
// Filtering these avoids false failures on examples that use audio, video, or
// WebGL features that require user gestures or hardware not present in CI.
const NOISE_PATTERNS = [
  /AudioContext was not allowed to start/i,
  /getUserMedia/i,
  /NotAllowedError/i,
  /NotFoundError/i,           // no camera/mic device in CI
  /OverconstrainedError/i,
  /ResizeObserver loop/i,
  /WebGL.*context lost/i,
  /INVALID_OPERATION/i,       // headless WebGL warnings
  /Could not create a BackingStoreGL/i,
  /THREE\.WebGLRenderer/i,    // Three.js internal warnings
  /sourceMap/i,
  /favicon/i,
  /\[Deprecation\]/i,
  /autoplay/i,
]

export function isNoise(msg) {
  return NOISE_PATTERNS.some(p => p.test(msg.text()))
}

/**
 * Navigate to an example by hash and wait up to `ms` for setup to complete.
 * Returns { errors } — filtered console errors seen during that window.
 */
export async function loadExample(page, name, ms = 4000) {
  const errors = []
  const handler = msg => {
    if (msg.type() === 'error' && !isNoise(msg)) errors.push(msg.text())
  }
  page.on('console', handler)

  await page.goto(`./#${name}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(ms)

  page.off('console', handler)
  return { errors }
}

/**
 * True if the PreviewPane error overlay is currently visible.
 * A visible overlay means setup() or update() threw an unhandled exception.
 */
export async function hasPreviewError(page) {
  return page.evaluate(() => {
    const el = document.querySelector('.preview-error')
    return el != null && el.style.display !== 'none' && el.textContent.trim().length > 0
  })
}

/**
 * True if a WebGL context was successfully obtained on the canvas.
 */
export async function canvasHasWebGL(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('#canvas-container canvas')
    if (!canvas) return false
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  })
}
