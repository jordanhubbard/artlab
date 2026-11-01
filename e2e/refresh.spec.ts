import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { build } from 'esbuild'
import { PNG } from 'pngjs'
import { EXAMPLES, EXAMPLE_ALIASES } from '../src/examples/catalog.ts'

// Browser screenshots retain the composited frame even when WebGL uses a
// transient drawing buffer. Inspect the canvas alone, excluding HTML controls.
async function frameStats(page: Page) {
  const { data } = PNG.sync.read(await page.locator('#canvas-container canvas').screenshot())
  let lit = 0
  const colors = new Set<string>()
  for (let i = 0; i < data.length; i += 64) {
    const r = data[i], g = data[i + 1], b = data[i + 2]
    if (Math.max(r, g, b) > 35) lit++
    colors.add(`${r >> 3},${g >> 3},${b >> 3}`)
  }
  return { lit, colors: colors.size }
}

for (const name of ['wave-sculpture', 'flocking-boids', 'physics-particles', 'clock-3d', 'interference-atlas', 'volume-observatory']) {
  test(`${name}: renders, interacts, and releases controls on navigation`, async ({ page }, testInfo) => {
    test.setTimeout(30_000)
    await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }))
    await page.route('**/favicon.ico', route => route.fulfill({ status: 204 }))
    const errors: string[] = []
    page.on('pageerror', e => errors.push(e.message))
    page.on('console', msg => { if (msg.type() === 'error') errors.push(`${msg.text()} ${msg.location().url}`) })
    await page.goto(`./#${name}`)
    const panel = page.locator('#canvas-container section')
    await expect(panel).toBeVisible()
    const stats = await frameStats(page)
    expect(stats.lit).toBeGreaterThan(50)
    expect(stats.colors).toBeGreaterThan(20)
    const screenshot = testInfo.outputPath(`${name}.png`)
    await page.locator('#canvas-container').screenshot({ path: screenshot })
    await testInfo.attach(name, { path: screenshot, contentType: 'image/png' })
    const slider = panel.locator('input').first()
    const maximum = await slider.getAttribute('max')
    if (maximum === null) throw new Error('Quality control has no maximum')
    await slider.fill(maximum)
    await slider.dispatchEvent('input')
    await expect(panel.locator('output').first()).toHaveText(await slider.inputValue())
    if (name === 'interference-atlas') {
      const phase = panel.locator('input').nth(1)
      await phase.fill('1.2')
      await phase.dispatchEvent('input')
      await expect(panel.locator('output').nth(1)).toHaveText('1.2')
      const adjusted = testInfo.outputPath('interference-phase.png')
      await page.locator('#canvas-container').screenshot({ path: adjusted })
      await testInfo.attach('asymmetric phase', { path: adjusted, contentType: 'image/png' })
    }
    await page.evaluate(() => { location.hash = '#hello-cube' })
    await expect(panel).toHaveCount(0)
    await expect(page.locator('.preview-error')).toHaveCount(0)
    expect(errors).toEqual([])
  })
}

for (const [alias, target] of Object.entries(EXAMPLE_ALIASES)) {
  test(`legacy #${alias} resolves to #${target}`, async ({ page }) => {
    await page.goto(`./#${alias}`)
    await expect(page).toHaveURL(new RegExp(`#${target}$`))
    await expect(page.locator('#canvas-container section')).toBeVisible()
    expect(EXAMPLES.some(ex => ex.name === alias)).toBe(false)
  })
}

test('standalone uses the same helpers and cleans successful, failed, and superseded runs', async ({ page }) => {
  test.setTimeout(30_000)
  const bundled = await build({ entryPoints: ['src/runtime/StandaloneRunner.ts'], bundle: true, write: false, format: 'esm' })
  await page.route('**/__standalone.js', route => route.fulfill({ contentType: 'text/javascript', body: bundled.outputFiles[0].text }))
  await page.goto('./#hello-cube')
  await expect(page.locator('#tb-build')).toContainText('OK')
  const result = await page.evaluate(async () => {
    const modulePath = './__standalone.js'
    const { StandaloneRunner }: typeof import('../src/runtime/StandaloneRunner.ts') = await import(modulePath)
    const canvas = document.createElement('canvas')
    canvas.id = 'standalone-test'
    document.body.append(canvas)
    const runner = new StandaloneRunner(canvas)
    let cleaned = 0, updated = 0
    await runner.run({
      setup(ctx) {
        ctx.setHelp('Standalone parity')
        ctx.add(ctx.mesh(ctx.box(), { color: 0xffcc88 }))
        ctx.scope.defer(() => cleaned++)
      },
      update() { updated++ },
    })
    const previewContext = window.__artlabIDE?.preview?.context
    const standaloneContext = runner.context
    const helpers = ['sphere', 'box', 'mesh', 'point', 'noise2', 'vec3', 'range', 'loadTexture'] as const
    const parity = helpers.every(name => typeof previewContext?.[name] === 'function' && typeof standaloneContext?.[name] === 'function')
    await new Promise(resolve => requestAnimationFrame(resolve))
    const visible = runner.scene.children.length === 1 && updated > 0
    let rejected = false
    try {
      await runner.run({ setup(ctx) { ctx.scope.defer(() => cleaned++); throw Error('intentional setup failure') } })
    } catch { rejected = true }
    const stopped = runner.context === null && runner.scene.children.length === 0
    let release: (() => void) | undefined
    let started: (() => void) | undefined
    const setupStarted = new Promise<void>(resolve => { started = resolve })
    const pending = runner.run({ async setup() {
      if (!started) throw new Error('Setup signal was not initialized')
      started()
      await new Promise<void>(resolve => { release = resolve })
    } })
    await setupStarted
    await runner.run({ setup(ctx) { ctx.add(ctx.mesh(ctx.sphere())) } })
    const current = runner.context
    if (!release) throw new Error('Pending setup was not initialized')
    release(); await pending
    const preserved = current === runner.context
    await runner.dispose(); canvas.remove()
    return { visible, rejected, stopped, preserved, cleaned, parity }
  })
  expect(result).toEqual({ visible: true, rejected: true, stopped: true, preserved: true, cleaned: 2, parity: true })
})
