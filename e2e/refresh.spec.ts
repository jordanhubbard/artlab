import { test, expect } from '@playwright/test'
import { build } from 'esbuild'
import { PNG } from 'pngjs'
import { EXAMPLES, EXAMPLE_ALIASES } from '../src/examples/catalog.ts'

// Browser screenshots retain the composited frame even when WebGL uses a
// transient drawing buffer. Inspect the canvas alone, excluding HTML controls.
async function frameStats(page) {
  const { data } = PNG.sync.read(await page.locator('#canvas-container canvas').screenshot())
  let lit = 0
  const colors = new Set()
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
    const errors = []
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
    await slider.fill(await slider.getAttribute('max'))
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
  await page.goto('./')
  const result = await page.evaluate(async () => {
    const { StandaloneRunner } = await import('./__standalone.js')
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
    await new Promise(resolve => requestAnimationFrame(resolve))
    const visible = runner._scene.children.length === 1 && updated > 0
    let rejected = false
    try {
      await runner.run({ setup(ctx) { ctx.scope.defer(() => cleaned++); throw Error('intentional setup failure') } })
    } catch { rejected = true }
    const stopped = runner._ctx === null && runner._scene.children.length === 0
    let release, started
    const setupStarted = new Promise(resolve => { started = resolve })
    const pending = runner.run({ async setup() { started(); await new Promise(resolve => { release = resolve }) } })
    await setupStarted
    await runner.run({ setup(ctx) { ctx.add(ctx.mesh(ctx.sphere())) } })
    const current = runner._ctx
    release(); await pending
    const preserved = current === runner._ctx
    await runner.dispose(); canvas.remove()
    return { visible, rejected, stopped, preserved, cleaned }
  })
  expect(result).toEqual({ visible: true, rejected: true, stopped: true, preserved: true, cleaned: 2 })
})
