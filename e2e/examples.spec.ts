/**
 * Per-example end-to-end tests.
 *
 * For every example registered in the IDE:
 *  1. Navigate via URL hash (#example-name)
 *  2. Wait for setup() to complete (up to 4 s; 6 s for heavier examples)
 *  3. Assert no .preview-error overlay is showing
 *  4. Assert WebGL context is present on the canvas
 *  5. Assert no unfiltered console errors occurred
 *
 * Media examples (camera / microphone) that legitimately cannot run in a
 * headless environment are tested with a softer check — we verify they don't
 * crash the IDE outright, but we skip the preview-error assertion because a
 * "permission denied" error overlay is expected and acceptable.
 */
import { test, expect } from '@playwright/test'
import { EXAMPLES } from '../src/examples/catalog.ts'
import { loadExample, hasPreviewError, canvasHasWebGL } from './helpers.ts'

// Examples that require live camera or microphone — they will always get a
// permission/device-not-found error in CI, so we only do a crash check.
const MEDIA_EXAMPLES = new Set([
  'audio-pulse',
  'video-fx',
  'video-broadcast',
  'video-kaleidoscope',
  'motion-scale-lantern',
  'signal-salvage',
])

// Examples with heavier async setup (texture loads, audio graph, many bodies).
// Give them extra time before asserting.
const SLOW_EXAMPLES = new Set([
  'solar-system',
  'fluid-2d',
  'n-body-gravity',
  'cloth-sim',
  'marble-run',
  'flocking-boids',
  'terrain-flyover',
  'audio-terrain',
  'music-synth',
  'music-visualizer',
  'synth-keyboard',
  'reaction-diffusion',
  'tide-eroded-vessel',
  'bell-orrery',
  'printable-bracket',
  'signal-salvage',
])



for (const { name } of EXAMPLES) {
  const isMedia = MEDIA_EXAMPLES.has(name)
  const isSlow  = SLOW_EXAMPLES.has(name)
  const waitMs  = isSlow ? 6000 : 4000

  test.describe(name, () => {
    test(`loads without crashing`, async ({ page }) => {
      const { errors } = await loadExample(page, name, waitMs)

      // WebGL must be available regardless of example type
      expect(await canvasHasWebGL(page)).toBe(true)

      if (isMedia) {
        // Media examples: just confirm the IDE itself didn't crash with a JS error
        // (a "permission denied" preview-error is acceptable in headless CI)
        expect(errors.filter(e => !/permission|NotAllowed|NotFound|device/i.test(e))).toHaveLength(0)
      } else {
        // All other examples: no preview-error overlay and no console errors
        const overlay = await hasPreviewError(page)
        if (overlay) {
          const msg = await page.evaluate(() =>
            document.querySelector('.preview-error')?.textContent?.trim() ?? ''
          )
          expect.soft(overlay, `preview-error visible: ${msg}`).toBe(false)
        }
        expect(errors).toHaveLength(0)
      }
    })
  })
}
