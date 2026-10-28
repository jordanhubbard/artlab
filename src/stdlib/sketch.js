// @ts-check
import * as Three from 'three'
import { InstanceField } from './scene/InstanceField.js'
import { ShaderSurface } from './scene/ShaderSurface.js'

/** @typedef {import('../runtime/contracts').ArtlabContext} Context */

/** Deterministic Mulberry32 stream; never changes global Math.random.
 * @param {number} seed
 */
export function seededRandom(seed) {
  return () => {
    let t = seed += 0x6D2B79F5
    t = Math.imul(t ^ t >>> 15, t | 1)
    t ^= t + Math.imul(t ^ t >>> 7, t | 61)
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

/** Bound catch-up after background tabs. The callback always sees the same dt.
 * @param {(dt: number) => void} step @param {number} [hz] @param {number} [maxSteps]
 */
export function fixedStep(step, hz = 60, maxSteps = 5) {
  const dt = 1 / hz
  let accumulator = 0
  return (/** @type {number} */ delta) => {
    accumulator = Math.min(accumulator + Math.max(0, delta), dt * maxSteps)
    while (accumulator + 1e-10 >= dt) {
      step(dt)
      accumulator -= dt
    }
  }
}

/** Reusable presentation rig; lifecycle remains owned by the host.
 * @param {Context} ctx @param {[number, number, number]} eye @param {number} [bloom]
 */
export function stage(ctx, eye, bloom = 0.35) {
  ctx.camera.position.set(...eye)
  ctx.camera.lookAt(0, 0, 0)
  ctx.controls.target.set(0, 0, 0)
  ctx.setBloom(bloom)
  ctx.scene.background = new Three.Color(0x050914)
  ctx.add(new Three.HemisphereLight(0x9cceff, 0x13162b, 2))
  const key = ctx.add(new Three.DirectionalLight(0xffd4a3, 3))
  key.position.set(5, 10, 8)
  const rim = ctx.add(new Three.DirectionalLight(0x44bfff, 2))
  rim.position.set(-8, 2, -5)
}

/** Procedural sky without an image asset; use with an orbiting scene camera.
 * @param {Context} ctx @param {number} [horizon] @param {number} [zenith]
 */
export function skyDome(ctx, horizon = 0x864e38, zenith = 0x08182e) {
  return ctx.add(new Three.Mesh(new Three.SphereGeometry(180, 32, 16), new Three.ShaderMaterial({
    uniforms: { horizon: { value: new Three.Color(horizon) }, zenith: { value: new Three.Color(zenith) } },
    vertexShader: 'varying vec3 skyPosition; void main(){skyPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: `varying vec3 skyPosition; uniform vec3 horizon,zenith;
      void main(){float h=normalize(skyPosition).y;
      vec3 c=mix(horizon,zenith,smoothstep(-0.18,0.55,h));
      c*=0.65+0.35*smoothstep(-0.6,0.0,h);
      gl_FragColor=vec4(c,1.0);}`,
    side: Three.BackSide, depthWrite: false,
  })))
}

/** One draw call for many objects; bounds disabled for animated transforms.
 * @param {Context} ctx @param {Three.BufferGeometry} geometry
 * @param {Three.Material} material @param {number} count
 */
export function instances(ctx, geometry, material, count) {
  return ctx.add(new InstanceField(count, geometry, material).object)
}

/** A camera-facing GPU canvas in the scene; all samples share the same uniforms.
 * @param {Context} ctx @param {string} fragmentShader
 * @param {Record<string, Three.IUniform>} uniforms
 * @param {number} [width] @param {number} [height]
 */
export function shaderPanel(ctx, fragmentShader, uniforms, width = 12, height = 8) {
  return ctx.add(new ShaderSurface(ctx.renderer, fragmentShader, uniforms, { width, height, fullscreen: false }).object)
}

/** Canvas-local normalized input. Window clicks never affect the sketch.
 * @param {Context} ctx @param {(point: Three.Vector2, event: PointerEvent) => void} handler
 * @param {string} [type]
 */
export function pointer(ctx, handler, type = 'pointerdown') {
  const canvas = ctx.renderer.domElement
  const position = new Three.Vector2()
  ctx.scope.listen(canvas, type, event => {
    const e = /** @type {PointerEvent} */ (event)
    const rect = canvas.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    position.set((e.clientX - rect.left) / rect.width * 2 - 1, 1 - (e.clientY - rect.top) / rect.height * 2)
    handler(position, e)
  })
}

/** Accessible controls attached to the sketch's canvas, automatically removed.
 * @param {Context} ctx @param {string} title
 * @param {Record<string, { min: number, max: number, step: number, value: number, change(value: number): void }>} sliders
 */
export function controlPanel(ctx, title, sliders) {
  const panel = document.createElement('section')
  panel.setAttribute('aria-label', title)
  panel.style.cssText = 'position:absolute;bottom:18px;left:18px;z-index:3;padding:14px 18px;background:#061020e8;color:#b9d5e9;border:1px solid #4c7b9855;border-radius:8px;font:12px monospace;max-width:calc(100% - 72px)'
  const heading = document.createElement('div')
  heading.textContent = title
  heading.style.cssText = 'letter-spacing:0.16em;color:#ffcf95;margin-bottom:12px'
  panel.append(heading)
  for (const [name, config] of Object.entries(sliders)) {
    const label = document.createElement('label')
    label.style.cssText = 'display:flex;align-items:center;gap:10px;margin-top:8px'
    const text = document.createElement('span')
    text.textContent = name
    text.style.minWidth = '92px'
    const input = document.createElement('input')
    input.type = 'range'
    input.min = String(config.min); input.max = String(config.max)
    input.step = String(config.step); input.value = String(config.value)
    const output = document.createElement('output')
    output.textContent = input.value
    ctx.scope.listen(input, 'input', () => {
      output.textContent = input.value
      config.change(Number(input.value))
    })
    label.append(text, input, output)
    panel.append(label)
  }
  ctx.renderer.domElement.parentElement?.append(panel)
  ctx.scope.defer(() => panel.remove())
  return panel
}

/** Rebuilt per simulation tick. Queries return only cells touching the radius.
 * @template {{ position: Three.Vector3 }} T
 */
export class SpatialHash {
  /** @type {Map<string, T[]>} */
  cells = new Map()
  /** @param {number} cellSize */
  constructor(cellSize) {
    if (!(cellSize > 0)) throw new RangeError('cellSize must be positive')
    this.cellSize = cellSize
  }
  /** @param {T[]} items */
  rebuild(items) {
    this.cells.clear()
    for (const item of items) {
      const { x, y, z } = item.position
      const key = `${Math.floor(x / this.cellSize)},${Math.floor(y / this.cellSize)},${Math.floor(z / this.cellSize)}`
      const cell = this.cells.get(key)
      if (cell) cell.push(item)
      else this.cells.set(key, [item])
    }
  }
  /** @param {Three.Vector3} point @param {number} radius @param {(item: T) => void} visit */
  query(point, radius, visit) {
    const s = this.cellSize
    for (let x = Math.floor((point.x - radius) / s); x <= Math.floor((point.x + radius) / s); x++)
      for (let y = Math.floor((point.y - radius) / s); y <= Math.floor((point.y + radius) / s); y++)
        for (let z = Math.floor((point.z - radius) / s); z <= Math.floor((point.z + radius) / s); z++) {
          for (const item of this.cells.get(`${x},${y},${z}`) ?? []) visit(item)
        }
  }
}
