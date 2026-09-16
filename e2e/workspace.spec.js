import { test, expect } from '@playwright/test'
import JSZip from 'jszip'
import { readFile } from 'node:fs/promises'

test('edit an example and its shared class, run, export, and reopen the same composition', async ({ page }) => {
  test.setTimeout(60_000)
  await page.goto('./#particle-storm')
  const state = () => page.evaluate(() => {
    const ide = window.__artlabIDE
    const mesh = ide?.preview?._ctx?._added.find(object => object.isInstancedMesh)
    return { count: mesh?.count, color: mesh?.material.color.getHex(), error: ide?._errors }
  })
  await expect.poll(async () => (await state()).count).toBe(500)
  await expect(page.locator('#btn-run')).toBeEnabled()

  await page.locator('#environment-source summary').click()
  await page.getByRole('searchbox', { name: 'Search environment source' }).fill('InstanceField')
  await page.locator('#environment-source button', { hasText: 'scene/InstanceField.js' }).click()
  await expect(page.locator('#st-file')).toHaveText('src/stdlib/scene/InstanceField.js')
  await page.evaluate(() => {
    const ide = window.__artlabIDE
    ide.editor.setValue(ide.editor.getValue().replace(
      'this.object.frustumCulled = false',
      'this.object.frustumCulled = false\n    this.object.material.color.set(0x00ff00)',
    ))
    ide.openFile(ide.manifest.entry)
    ide.editor.setValue(ide.editor.getValue().replace('count: 500', 'count: 72'))
  })
  await page.locator('#btn-run').click()
  await expect.poll(async () => (await state()).count).toBe(72)
  await expect.poll(async () => (await state()).color).toBe(0x00ff00)
  expect((await state()).error).toEqual([])

  const downloadPromise = page.waitForEvent('download')
  await page.locator('#btn-export').click()
  const download = await downloadPromise
  const bytes = await readFile(await download.path())
  const zip = await JSZip.loadAsync(bytes)
  expect(await zip.file('src/stdlib/scene/InstanceField.js').async('string')).toContain('color.set(0x00ff00)')
  expect(await zip.file('examples/particle-storm/particle-storm.js').async('string')).toContain('count: 72')
  await page.evaluate(() => { location.hash = '#hello-cube' })
  await page.setInputFiles('#file-input', { name: 'edited.zip', mimeType: 'application/zip', buffer: bytes })
  await expect.poll(async () => (await state()).count).toBe(72)
  await expect.poll(async () => (await state()).color).toBe(0x00ff00)
})

test('runs an imported TypeScript entry and helper, and reports a broken helper', async ({ page }) => {
  test.setTimeout(60_000)
  const zip = new JSZip()
  zip.file('artlab.json', JSON.stringify({ name: 'typed-scene', version: '1.0.0', entry: 'main.ts' }))
  zip.file('main.ts', `
    import { Palette } from './Palette'
    export async function setup(ctx: any): Promise<void> {
      const marker = await (await fetch(new URL('./assets/marker.txt', import.meta.url))).text()
      const palette: Palette = new Palette()
      const cube = ctx.add(ctx.mesh(ctx.box(), { color: palette.color }))
      cube.userData.marker = marker
    }
  `)
  zip.file('Palette.ts', 'export class Palette { readonly color: number = 0x123456 }')
  zip.file('assets/marker.txt', 'loaded from the ZIP')
  await page.goto('./')
  await expect(page.locator('.ex-row').first()).toBeVisible()
  await page.setInputFiles('#file-input', { name: 'typed.zip', mimeType: 'application/zip', buffer: await zip.generateAsync({ type: 'nodebuffer' }) })
  await expect.poll(() => page.evaluate(() => window.__artlabIDE.preview._ctx?._added[0]?.material?.color.getHex())).toBe(0x123456)
  expect(await page.evaluate(() => window.__artlabIDE.preview._ctx._added[0].userData.marker)).toBe('loaded from the ZIP')
  await page.evaluate(() => {
    const ide = window.__artlabIDE
    ide.openFile('Palette.ts')
    ide.editor.setValue('export class Palette { broken = ; }')
  })
  await page.locator('#btn-run').click()
  await expect(page.locator('#tb-build')).toContainText('Error')
  await expect(page.locator('#out-errors')).toContainText('Palette.ts')
})

test('a helper edit survives reloading a bookmarked example', async ({ page }) => {
  test.setTimeout(60_000)
  await page.goto('./#particle-storm')
  await expect.poll(() => page.evaluate(() => window.__artlabIDE?.preview?._ctx?._added[0]?.count)).toBe(500)
  await page.evaluate(async () => {
    const ide = window.__artlabIDE
    await ide.openSource('examples/particle-storm/EmberField.js')
    ide.editor.setValue(ide.editor.getValue().replace('0.06, 4, 4', '0.12, 4, 4'))
    await ide.compile()
  })
  await page.reload()
  await expect.poll(() => page.evaluate(() => window.__artlabIDE?.preview?._ctx?._added[0]?.geometry?.parameters?.radius)).toBe(0.12)
})
