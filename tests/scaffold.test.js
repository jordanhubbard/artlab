// @vitest-environment jsdom
import { test, expect } from 'vitest'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { makeContext } from './context.js'

test('CLI scaffolds an executable sketch using shared context and scoped input', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'artlab-scaffold-'))
  let ctx
  try {
    execFileSync(process.execPath, [resolve('bin/artlab.js'), 'create', 'fresh-demo'], { cwd: directory })
    const pkg = join(directory, 'fresh-demo')
    const manifest = JSON.parse(readFileSync(join(pkg, 'artlab.json'), 'utf8'))
    expect(manifest.entry).toBe('main.js')
    const source = readFileSync(join(pkg, manifest.entry), 'utf8')
    const mod = await import(/* @vite-ignore */ `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
    ctx = makeContext()
    mod.setup(ctx); mod.update(ctx, 0.1)
    const before = ctx.state.shape.material.color.getHex()
    ctx.renderer.domElement.dispatchEvent(new Event('pointerdown'))
    expect(ctx.state.shape.material.color.getHex()).not.toBe(before)
    mod.teardown(ctx)
    const after = ctx.state.shape.material.color.getHex()
    ctx.renderer.domElement.dispatchEvent(new Event('pointerdown'))
    expect(ctx.state.shape.material.color.getHex()).toBe(after)
    ctx.dispose()
    expect(ctx.scene.children).toHaveLength(0)
  } finally {
    ctx?.renderer.domElement.parentElement.remove()
    rmSync(directory, { recursive: true, force: true })
  }
})
