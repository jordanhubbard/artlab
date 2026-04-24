// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as Three from 'three'

vi.mock('three', async () => await vi.importActual('three'))

// CSS2DObject must extend Object3D so Three.js Object3D.add() accepts it
vi.mock('three/addons/renderers/CSS2DRenderer.js', async () => {
  const { Object3D } = await vi.importActual('three')
  class CSS2DObject extends Object3D {
    constructor(element) {
      super()
      this.element = element
      this.isCSS2DObject = true
    }
  }
  class CSS2DRenderer {
    constructor() { this.domElement = document.createElement('div') }
    setSize() {}
    render() {}
  }
  return { CSS2DObject, CSS2DRenderer }
})

// ── Mock ctx ──────────────────────────────────────────────────────────────────

function makeMockCtx(overrides = {}) {
  const scene = { add: vi.fn(), remove: vi.fn(), children: [] }
  const camera = {
    position: new Three.Vector3(0, 0, 50),
    lookAt:   vi.fn(),
    aspect:   1,
    updateProjectionMatrix: vi.fn(),
    fov: 60,
  }
  const controls = {
    update:        vi.fn(),
    enableDamping: true,
    enabled:       true,
    target:        new Three.Vector3(),
  }
  const container = document.createElement('div')
  const canvas    = document.createElement('canvas')
  container.appendChild(canvas)

  return {
    Three,
    scene,
    camera,
    renderer: {
      domElement: canvas,
      setSize:    vi.fn(),
      render:     vi.fn(),
      shadowMap:  { enabled: false },
      toneMapping: 0,
    },
    controls,
    labelRenderer: {
      render:     vi.fn(),
      setSize:    vi.fn(),
      domElement: document.createElement('div'),
    },
    add:      vi.fn(),
    remove:   vi.fn(),
    setBloom: vi.fn(),
    setHelp:  vi.fn(),
    elapsed:  0,
    ...overrides,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('data-sculpture', () => {
  let ctx
  let setup, update, teardown

  beforeEach(async () => {
    ctx = makeMockCtx()
    ;({ setup, update, teardown } = await import('./data-sculpture.js'))
  })

  afterEach(() => {
    teardown(ctx)
  })

  it('setup() completes without throwing', () => {
    expect(() => setup(ctx)).not.toThrow()
  })

  it('setup() adds 2 lights + 5 anchors + 60 bars = 67 objects', () => {
    setup(ctx)
    // 2 lights + 5 city anchors + (5 cities × 12 months) bars
    expect(ctx.add).toHaveBeenCalledTimes(67)
  })

  it('update() runs multiple frames without throwing', () => {
    setup(ctx)
    for (const elapsed of [0, 0.016, 0.5, 2.0]) {
      ctx.elapsed = elapsed
      expect(() => update(ctx, 0.016)).not.toThrow()
    }
  })

  it('teardown() runs without throwing', () => {
    setup(ctx)
    expect(() => teardown(ctx)).not.toThrow()
  })

  it('teardown() removes every object added during setup()', () => {
    setup(ctx)
    teardown(ctx)
    expect(ctx.remove).toHaveBeenCalledTimes(67)
  })

  it('teardown() is idempotent — calling twice does not throw', () => {
    setup(ctx)
    teardown(ctx)
    expect(() => teardown(ctx)).not.toThrow()
  })
})
