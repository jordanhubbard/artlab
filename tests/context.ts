import * as Three from 'three'
import { vi } from 'vitest'
import { SceneContext } from '../src/runtime/SceneContext.ts'
import type { ArtlabContext, RuntimeBindings } from '../src/runtime/contracts.ts'

// Real scene and public context; only the GPU-backed host objects are stubbed.
export function makeContext() {
  const container = document.createElement('div')
  const canvas = document.createElement('canvas')
  canvas.getBoundingClientRect = () => new DOMRect(0, 0, 800, 600)
  container.append(canvas)
  document.body.append(container)
  const camera = new Three.PerspectiveCamera(60, 4 / 3, 0.1, 10000)
  return new SceneContext({
    scene: new Three.Scene(), camera,
    // GPU-backed host objects are deliberately stubbed at the test boundary.
    renderer: {
      domElement: canvas, shadowMap: { enabled: false, type: Three.PCFSoftShadowMap },
      setSize() {}, render() {},
    } as unknown as RuntimeBindings['renderer'],
    controls: {
      target: new Three.Vector3(), enabled: true, enableDamping: true,
      minDistance: 0, maxDistance: Infinity, update() { return false },
    } as RuntimeBindings['controls'],
    labelRenderer: {
      domElement: document.createElement('div'), render() {}, setSize() {},
      getSize() { return { width: 800, height: 600 } },
    },
    setHelp() {}, setBloom() {},
  })
}

export function makeSpiedContext() {
  const ctx = makeContext()
  vi.spyOn(ctx.camera, 'lookAt')
  vi.spyOn(ctx.camera.position, 'set')
  vi.spyOn(ctx.controls.target, 'set')
  vi.spyOn(ctx.renderer.domElement, 'addEventListener')
  vi.spyOn(ctx.renderer.domElement, 'removeEventListener')
  return Object.assign(ctx, {
    add: vi.fn(ctx.add), remove: vi.fn(ctx.remove),
    setHelp: vi.fn(ctx.setHelp), setBloom: vi.fn(ctx.setBloom),
  })
}

// Legacy demos initialize their additional context fields inside setup(). Keep
// the one lifecycle assertion here, and expose the extended type only on success.
export function initialize<C extends ArtlabContext, B extends ArtlabContext>(setup: (ctx: C) => void, base: B): C & B {
  const ctx = base as C & B
  const result: unknown = setup(ctx)
  if (result && typeof result === 'object' && 'then' in result) throw new TypeError('Use initializeAsync for asynchronous setup')
  return ctx
}

export async function initializeAsync<C extends ArtlabContext, B extends ArtlabContext>(setup: (ctx: C) => unknown, base: B): Promise<C & B> {
  const ctx = base as C & B
  await setup(ctx)
  return ctx
}

export type DemoContext<M extends { setup(ctx: never): unknown }> = Parameters<M['setup']>[0] & ReturnType<typeof makeSpiedContext>

export function required<T>(value: T, message = 'Required test fixture value is missing'): NonNullable<T> {
  if (value == null) throw new Error(message)
  return value
}

export function containerOf(ctx: ArtlabContext): HTMLElement {
  return required(ctx.renderer.domElement.parentElement)
}

// jsdom has no native canvas renderer. Keep its partial implementation at this
// explicit browser boundary while checking the test's own stub methods normally.
export function canvas2D<T extends object>(stub: T): T & CanvasRenderingContext2D {
  return stub as T & CanvasRenderingContext2D
}

export function mockCanvas2D(factory: () => object) {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: vi.fn((type: string) => type === '2d' ? canvas2D(factory()) : null),
  })
}

export function autoClickButtons() {
  const original = EventTarget.prototype.addEventListener
  vi.spyOn(HTMLButtonElement.prototype, 'addEventListener').mockImplementation(function (
    this: HTMLButtonElement, type: string, listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ) {
    original.call(this, type, listener, options)
    if (type === 'click') this.click()
  })
}
