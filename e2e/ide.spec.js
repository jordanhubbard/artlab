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
    test.setTimeout(75_000)
    await page.goto('./#signal-salvage', { waitUntil: 'domcontentloaded' })
    const game = page.locator('[data-signal-salvage]')
    await expect(game.getByRole('button', { name: 'START MISSION' })).toBeVisible()
    await expect(game).toContainText('Camera → signal veil & motion ripples')
    await expect(game).toContainText('Microphone → pulse charge & world intensity')
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
    // The first anomaly is telegraphed 4.5s into mission time, but the example
    // clamps each frame's delta to 50ms so a stall cannot tunnel entities
    // through the player. Under software WebGL the render loop can fall below
    // that clamp, which makes mission time run slower than wall clock, so this
    // wait has to be several times the nominal 4.5s.
    await expect(hud).toContainText(
      /EVENT\s+(WARNING:|DEBRIS|CORRUPTION|GRAVITY|BLACKOUT|SIGNAL)/,
      { timeout: 30_000 },
    )

    await page.evaluate(() => { location.hash = '#hello-cube' })
    await expect(game).toHaveCount(0)
  })

  test('Signal Salvage makes synthetic camera and microphone input visible', async ({ page }) => {
    test.setTimeout(45_000)
    await page.evaluate(() => {
      window.__signalInitError = null
      try {
        const canvas = document.createElement('canvas')
        canvas.width = 64
        canvas.height = 48
        const context = canvas.getContext('2d')
        const cameraStream = canvas.captureStream(0)
        const videoTrack = cameraStream.getVideoTracks()[0]
        let phase = false
        const animation = setInterval(() => {
          phase = !phase
          context.fillStyle = '#001122'
          context.fillRect(0, 0, 64, 48)
          context.fillStyle = '#ffffff'
          context.fillRect(phase ? 0 : 32, 0, 32, 48)
          videoTrack.requestFrame()
        }, 80)
        const sourceContext = new AudioContext()
        const oscillator = sourceContext.createOscillator()
        const gain = sourceContext.createGain()
        const destination = sourceContext.createMediaStreamDestination()
        gain.gain.value = 0.65
        oscillator.connect(gain).connect(destination)
        oscillator.start()
        window.__signalSyntheticMedia = {
          animation,
          cameraStream,
          sourceContext,
          oscillator,
          microphoneStream: destination.stream,
        }
        Object.defineProperty(navigator, 'mediaDevices', {
          configurable: true,
          value: {
            getUserMedia: constraints => Promise.resolve(
              constraints.video ? cameraStream : destination.stream,
            ),
          },
        })
      } catch (error) {
        window.__signalInitError = error.message
      }
    })
    await page.goto('./#signal-salvage', { waitUntil: 'domcontentloaded' })
    expect(await page.evaluate(() => window.__signalInitError)).toBeNull()
    await page.getByRole('button', { name: 'START MISSION' }).click()
    const hud = page.locator('[data-signal-salvage] pre')

    await expect(hud).toContainText(/CAMERA\s+ACTIVE/, { timeout: 15_000 })
    await expect(hud).toContainText(/MIC\s+ACTIVE/, { timeout: 15_000 })
    await expect.poll(async () => hud.textContent()).not.toMatch(/CAM MOTION\s+░{10}/)
    await expect.poll(async () => hud.textContent()).not.toMatch(/MIC ENERGY\s+░{10}/)

    await page.evaluate(() => { location.hash = '#hello-cube' })
    await page.evaluate(async () => {
      const media = window.__signalSyntheticMedia
      clearInterval(media.animation)
      media.oscillator.stop()
      await media.sourceContext.close()
    })
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
