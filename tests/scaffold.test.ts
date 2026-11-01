// @vitest-environment jsdom
import { test, expect } from 'vitest'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { makeContext } from './context.ts'
import type { RuntimeModule } from '../src/runtime/StandaloneRunner.ts'
import { parseManifest } from '../src/ide/WorkspaceData.ts'

test('CLI scaffolds an executable sketch using shared context and scoped input', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'artlab-scaffold-'))
  let ctx: ReturnType<typeof makeContext> | undefined
  try {
    execFileSync(process.execPath, [resolve('bin/artlab.ts'), 'create', 'fresh-demo'], { cwd: directory })
    const pkg = join(directory, 'fresh-demo')
    const manifest = parseManifest(readFileSync(join(pkg, 'artlab.json'), 'utf8'))
    expect(manifest.entry).toBe('main.ts')
    const source = readFileSync(join(pkg, manifest.entry), 'utf8')
    const mod: RuntimeModule = await import(/* @vite-ignore */ `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
    if (!mod.setup || !mod.update || !mod.teardown) throw new Error('Scaffold is missing lifecycle exports')
    ctx = makeContext()
    await mod.setup(ctx)
    mod.update(ctx, 0.1)
    if (!('state' in ctx) || !ctx.state || typeof ctx.state !== 'object' || !('shape' in ctx.state)) {
      throw new Error('Scaffold did not initialize its state')
    }
    const shape = ctx.state.shape
    if (!(shape instanceof ctx.Three.Mesh) || !(shape.material instanceof ctx.Three.MeshStandardMaterial)) {
      throw new Error('Scaffold did not create a standard material mesh')
    }
    const before = shape.material.color.getHex()
    ctx.renderer.domElement.dispatchEvent(new Event('pointerdown'))
    expect(shape.material.color.getHex()).not.toBe(before)
    await mod.teardown(ctx)
    const after = shape.material.color.getHex()
    ctx.renderer.domElement.dispatchEvent(new Event('pointerdown'))
    expect(shape.material.color.getHex()).toBe(after)
    ctx.dispose()
    expect(ctx.scene.children).toHaveLength(0)
  } finally {
    ctx?.renderer.domElement.parentElement?.remove()
    rmSync(directory, { recursive: true, force: true })
  }
})
