/**
 * IDE shell smoke tests — verifies the app loads and basic structure is present
 * before any example is selected.
 */
import { test, expect } from '@playwright/test'

test.describe('IDE shell', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./', { waitUntil: 'domcontentloaded' })
  })

  test('page title is Artlab', async ({ page }) => {
    await expect(page).toHaveTitle(/artlab/i)
  })

  test('canvas is present', async ({ page }) => {
    await expect(page.locator('#canvas-container canvas')).toBeVisible()
  })

  test('examples nav is populated', async ({ page }) => {
    // Wait for JS to build the nav (at least 10 rows)
    const rows = page.locator('.ex-row')
    await expect(rows.first()).toBeVisible({ timeout: 10000 })
    expect(await rows.count()).toBeGreaterThanOrEqual(10)
  })

  test('hash routing: #aurora loads aurora example', async ({ page }) => {
    await page.goto('./#aurora', { waitUntil: 'domcontentloaded' })
    // Wait for sidebar to build then for aurora row to get active class
    await expect(page.locator('.ex-row[data-name="aurora"]')).toHaveClass(/active/, { timeout: 10000 })
  })

  test('switching away from solar-system clears its planet labels', async ({ page }) => {
    // solar-system loads textures and an audio graph before any label appears.
    test.setTimeout(45_000)
    // CSS2D labels are DOM nodes in an overlay rather than scene objects, so a
    // teardown that only detaches meshes leaves them stranded on screen.
    const labelCount = () => page.evaluate(() => {
      const names = ['MERCURY', 'VENUS', 'EARTH', 'MARS', 'JUPITER', 'SATURN', 'URANUS', 'NEPTUNE']
      return [...document.querySelectorAll('div')]
        .filter(d => d.children.length === 0 && names.includes(d.textContent.trim()))
        .length
    })

    await page.goto('./#solar-system', { waitUntil: 'domcontentloaded' })
    await expect.poll(labelCount, { timeout: 15000 }).toBeGreaterThan(0)

    await page.evaluate(() => { location.hash = '#hello-cube' })
    await expect.poll(labelCount, { timeout: 10000 }).toBe(0)
  })

  test('Signal Salvage plays with keyboard fallback and tears down cleanly', async ({ page }) => {
    test.setTimeout(45_000)
    await page.goto('./#signal-salvage', { waitUntil: 'domcontentloaded' })
    const game = page.locator('[data-signal-salvage]')
    await expect(game.getByRole('button', { name: 'START MISSION' })).toBeVisible()
    await game.getByRole('button', { name: 'START MISSION' }).click()

    const hud = game.locator('pre')
    await expect(hud).toContainText('PLAYING', { timeout: 15000 })
    await expect(hud).toContainText(/CAMERA\s+(DENIED|UNAVAILABLE)/)
    await expect(hud).toContainText(/MIC\s+(DENIED|UNAVAILABLE)/)

    await page.keyboard.down('ArrowRight')
    await page.waitForTimeout(250)
    await page.keyboard.up('ArrowRight')
    await page.keyboard.down('Space')
    await page.waitForTimeout(250)
    await page.keyboard.up('Space')
    await page.waitForTimeout(750)
    await expect(hud).toContainText(/TIME\s+8[0-9]/)

    await page.evaluate(() => { location.hash = '#hello-cube' })
    await expect(game).toHaveCount(0)
  })

  test('Signal Salvage stops media that resolves after switching examples', async ({ page }) => {
    test.setTimeout(45_000)
    await page.evaluate(() => {
      const pending = []
      window.__signalProbe = { pending, error: null }
      try {
        const canvas = document.createElement('canvas')
        canvas.width = 32
        canvas.height = 24
        const cameraStream = canvas.captureStream(5)
        const sourceContext = new AudioContext()
        const oscillator = sourceContext.createOscillator()
        const destination = sourceContext.createMediaStreamDestination()
        oscillator.connect(destination)
        oscillator.start()
        const microphoneStream = destination.stream
        Object.assign(window.__signalProbe, {
          cameraStream,
          microphoneStream,
          sourceContext,
          oscillator,
        })
        Object.defineProperty(navigator, 'mediaDevices', {
          configurable: true,
          value: {
            getUserMedia: constraints => new Promise(resolve => {
              pending.push({ resolve, video: Boolean(constraints.video) })
            }),
          },
        })
      } catch (error) {
        window.__signalProbe.error = error.message
      }
    })

    await page.goto('./#signal-salvage', { waitUntil: 'domcontentloaded' })
    expect(await page.evaluate(() => window.__signalProbe?.error)).toBeNull()
    await page.getByRole('button', { name: 'START MISSION' }).click()
    await expect.poll(() => page.evaluate(() => window.__signalProbe.pending.length)).toBe(2)
    await page.evaluate(() => { location.hash = '#hello-cube' })
    await page.evaluate(() => {
      const probe = window.__signalProbe
      for (const request of probe.pending) {
        request.resolve(request.video ? probe.cameraStream : probe.microphoneStream)
      }
    })

    await expect.poll(() => page.evaluate(() => {
      const probe = window.__signalProbe
      return [...probe.cameraStream.getTracks(), ...probe.microphoneStream.getTracks()]
        .every(track => track.readyState === 'ended')
    })).toBe(true)
    await page.evaluate(async () => {
      window.__signalProbe.oscillator.stop()
      await window.__signalProbe.sourceContext.close()
    })
  })

  test('no JS errors on cold load', async ({ page }) => {
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    await page.goto('./', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)
    expect(errors).toHaveLength(0)
  })
})
