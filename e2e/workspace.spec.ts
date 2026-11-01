import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import JSZip from 'jszip'
import { readFile } from 'node:fs/promises'

async function particleState(page: Page) {
  return page.evaluate(() => {
    const ide = window.__artlabIDE
    const ctx = ide?.preview?.context
    if (!ctx) return { count: undefined, color: undefined, error: ide?.diagnostics }
    // Imported sketches and host helpers can use separate Three module instances.
    const mesh = ctx.scene.children.find((object): object is import('three').InstancedMesh =>
      'isInstancedMesh' in object && object.isInstancedMesh === true)
    const isBasic = (material: import('three').Material | import('three').Material[] | undefined): material is import('three').MeshBasicMaterial =>
      !!material && !Array.isArray(material) && 'isMeshBasicMaterial' in material && material.isMeshBasicMaterial === true
    const color = isBasic(mesh?.material) ? mesh.material.color.getHex() : undefined
    return { count: mesh?.count, color, error: ide?.diagnostics }
  })
}

test('edit an example and its shared class, run, export, and reopen the same composition', async ({ page }) => {
  test.setTimeout(60_000)
  await page.goto('./#physics-particles')
  const state = () => particleState(page)
  await expect.poll(async () => (await state()).count).toBe(2400)
  await expect(page.locator('#btn-run')).toBeEnabled()

  await page.locator('#environment-source summary').click()
  await page.getByRole('searchbox', { name: 'Search environment source' }).fill('InstanceField')
  await page.locator('#environment-source button', { hasText: 'scene/InstanceField.ts' }).click()
  await expect(page.locator('#st-file')).toHaveText('src/stdlib/scene/InstanceField.ts')
  await page.evaluate(() => {
    const ide = window.__artlabIDE
    if (!ide?.editor || !ide.manifest) throw new Error('Editor has no active package')
    ide.editor.setValue(ide.editor.getValue().replace(
      'this.object.frustumCulled = false',
      'this.object.frustumCulled = false\n    this.object.material.color.set(0x00ff00)',
    ))
    ide.openFile(ide.manifest.entry)
    ide.editor.setValue(ide.editor.getValue().replace('const COUNT = 2400', 'const COUNT = 72'))
  })
  await page.locator('#btn-run').click()
  await expect.poll(async () => (await state()).count).toBe(72)
  await expect.poll(async () => (await state()).color).toBe(0x00ff00)
  expect((await state()).error).toEqual([])

  const downloadPromise = page.waitForEvent('download')
  await page.locator('#btn-export').click()
  const download = await downloadPromise
  const downloadPath = await download.path()
  if (!downloadPath) throw new Error('Export did not produce a local download')
  const bytes = await readFile(downloadPath)
  const zip = await JSZip.loadAsync(bytes)
  const sharedSource = zip.file('src/stdlib/scene/InstanceField.ts')
  const sketchSource = zip.file('examples/physics-particles/physics-particles.ts')
  if (!sharedSource || !sketchSource) throw new Error('Export is missing edited source')
  expect(await sharedSource.async('string')).toContain('color.set(0x00ff00)')
  expect(await sketchSource.async('string')).toContain('const COUNT = 72')
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
  const importedState = () => page.evaluate(() => {
    const ctx = window.__artlabIDE?.preview?.context
    if (!ctx) return null
    const mesh = ctx.scene.children.find((object): object is import('three').Mesh => 'isMesh' in object && object.isMesh === true)
    const isStandard = (material: import('three').Material | import('three').Material[] | undefined): material is import('three').MeshStandardMaterial =>
      !!material && !Array.isArray(material) && 'isMeshStandardMaterial' in material && material.isMeshStandardMaterial === true
    if (!mesh || !isStandard(mesh.material)) return null
    const marker: unknown = mesh.userData.marker
    return { color: mesh.material.color.getHex(), marker: typeof marker === 'string' ? marker : undefined }
  })
  await expect.poll(async () => (await importedState())?.color).toBe(0x123456)
  expect((await importedState())?.marker).toBe('loaded from the ZIP')
  await page.evaluate(() => {
    const ide = window.__artlabIDE
    if (!ide?.editor) throw new Error('Editor did not initialize')
    ide.openFile('Palette.ts')
    ide.editor.setValue('export class Palette { broken = ; }')
  })
  await page.locator('#btn-run').click()
  await expect(page.locator('#tb-build')).toContainText('Error')
  await expect(page.locator('#out-errors')).toContainText('Palette.ts')
})

test('a helper edit survives reloading a bookmarked example', async ({ page }) => {
  test.setTimeout(60_000)
  await page.goto('./#physics-particles')
  await expect.poll(async () => (await particleState(page)).count).toBe(2400)
  await page.evaluate(async () => {
    const ide = window.__artlabIDE
    if (!ide?.editor) throw new Error('Editor did not initialize')
    await ide.openSource('src/stdlib/scene/InstanceField.ts')
    ide.editor.setValue(ide.editor.getValue().replace('this.object.frustumCulled = false', 'this.object.frustumCulled = false\n    this.object.material.color.set(0x00ff00)'))
    await ide.compile()
  })
  await page.reload()
  await expect.poll(async () => (await particleState(page)).color).toBe(0x00ff00)
})
