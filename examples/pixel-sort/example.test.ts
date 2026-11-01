// @vitest-environment jsdom
import * as Three from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DemoContext } from '../../tests/context.ts'
import { initialize, makeSpiedContext } from '../../tests/context.ts'
type Demo = typeof import('./pixel-sort.ts')

vi.mock('three', async () => await vi.importActual('three'))

describe('pixel-sort', () => {
  let ctx: DemoContext<Demo>
  let base: ReturnType<typeof makeSpiedContext>
  let setup: Demo["setup"], update: Demo["update"], teardown: Demo["teardown"]

  beforeEach(async () => {
    vi.clearAllMocks()
    base = makeSpiedContext()
    ;({ setup, update, teardown } = await import('./pixel-sort.ts'))
  })

  it('setup() creates texture quad', () => {
    ctx = initialize(setup, base)
    expect(ctx._quad).toBeInstanceOf(Three.Mesh)
    expect(ctx._pixelData.length).toBe(256 * 256 * 4)
  })

  it('pixel data is populated on setup', () => {
    ctx = initialize(setup, base)
    // Check that at least some pixels are non-zero
    let nonZero = 0
    for (let i = 0; i < 100; i++) {
      if (ctx._pixelData[i * 4] > 0) nonZero++
    }
    expect(nonZero).toBeGreaterThan(0)
  })

  it('update() sorts rows and marks texture for update', () => {
    ctx = initialize(setup, base)
    update(ctx, 0.016)
    // sortRow advanced (sorting happened)
    expect(ctx._sortRow).toBeGreaterThan(0)
  })

  it('sorting modifies pixel data', () => {
    ctx = initialize(setup, base)
    const before = new Uint8Array(ctx._pixelData)
    for (let i = 0; i < 10; i++) update(ctx, 0.02)
    let diffs = 0
    for (let i = 0; i < before.length; i += 4) {
      if (before[i] !== ctx._pixelData[i]) diffs++
    }
    expect(diffs).toBeGreaterThan(0)
  })

  it('teardown() cleans up', () => {
    ctx = initialize(setup, base)
    teardown(ctx)
    expect(ctx.remove).toHaveBeenCalled()
  })
})
