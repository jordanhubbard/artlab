// data-sculpture.js — 3D grouped bar chart of monthly city temperatures
import * as Three from 'three'
import { box, mesh } from '../../src/stdlib/geometry.js'
import { label, hud, tooltip } from '../../src/stdlib/ui.js'

const CITIES = ['New York', 'Miami', 'London', 'Tokyo', 'Sydney']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Monthly average temperatures in °C
const DATA = [
  [ 2,  4,  8, 14, 20, 25, 29, 28, 23, 16, 10,  4],  // New York
  [20, 21, 23, 26, 28, 30, 32, 32, 30, 27, 24, 21],  // Miami
  [ 5,  5,  8, 11, 14, 18, 20, 19, 17, 13,  8,  5],  // London
  [ 5,  6, 10, 15, 19, 23, 27, 29, 25, 18, 13,  7],  // Tokyo
  [25, 25, 23, 20, 16, 13, 12, 14, 16, 19, 22, 24],  // Sydney
]

const GAP_X  = 1.5    // month column spacing (X axis)
const GAP_Z  = 2.2    // city row spacing (Z axis)
const SCALE_Y = 0.15  // scene units per °C

// Module-level state — reset in teardown so setup() is idempotent
let _objects = []   // everything added via ctx.add() → removed in teardown
let _bars    = []   // bar meshes only, used by raycaster
let _labels  = []   // label handles → detached in teardown
let _hud     = null
let _tip     = null
let _onMove  = null

// Maps temperature (°C) to a Three.Color: blue (cold) → white (mild) → red (hot)
function _tempColor(t) {
  const c = new Three.Color()
  if (t <= 16) {
    const f = Math.max(0, t / 16)
    c.setRGB(f, f, 1)
  } else {
    const f = Math.min(1, (t - 16) / 16)
    c.setRGB(1, 1 - f, 1 - f)
  }
  return c
}

export function setup(ctx) {
  ctx.setHelp('Hover a bar to see city and temperature')

  // Warm ambient + directional from above
  const amb = new Three.AmbientLight(0xfff5e8, 0.65)
  ctx.add(amb)
  _objects.push(amb)

  const dir = new Three.DirectionalLight(0xffd8a0, 1.3)
  dir.position.set(8, 22, 12)
  ctx.add(dir)
  _objects.push(dir)

  ctx.camera.position.set(18, 18, 22)
  ctx.camera.lookAt(0, 2, 0)
  if (ctx.controls) {
    ctx.controls.target.set(0, 2, 0)
    ctx.controls.update()
  }

  const offsetX = ((MONTHS.length - 1) * GAP_X) / 2
  const offsetZ = ((CITIES.length  - 1) * GAP_Z) / 2

  for (let ci = 0; ci < CITIES.length; ci++) {
    const z = ci * GAP_Z - offsetZ

    // City name label — anchored left of the row
    const anchor = new Three.Object3D()
    anchor.position.set(-offsetX - 2.4, 0.6, z)
    ctx.add(anchor)
    _objects.push(anchor)
    _labels.push(label(anchor, CITIES[ci], { color: '#dde8ff', fontSize: '13px', offsetY: 0.2 }))

    for (let mi = 0; mi < MONTHS.length; mi++) {
      const temp = DATA[ci][mi]
      const h    = Math.max(0.2, temp * SCALE_Y)
      const x    = mi * GAP_X - offsetX

      const m = mesh(box(1.05, h, 1.05), {
        color:     _tempColor(temp),
        roughness: 0.55,
        metalness: 0.15,
      })
      m.position.set(x, h / 2, z)
      m.userData = {
        city:  CITIES[ci],
        month: mi,
        temp,
        baseH:  h,
        // staggered wave phase so the pulse ripples across the chart
        phase: (ci * MONTHS.length + mi) * 0.31,
      }
      ctx.add(m)
      _objects.push(m)
      _bars.push(m)
    }
  }

  // HUD: title + colour legend
  _hud = hud({ position: 'top-left' })
  _hud.setHTML(`
    <div style="font-family:monospace;line-height:1.9">
      <b style="font-size:14px">Monthly Temperatures</b><br>
      <span style="color:#6688ff">■</span> Cold &nbsp;
      <span style="color:#ddddff">■</span> Mild &nbsp;
      <span style="color:#ff6644">■</span> Hot<br>
      <span style="opacity:0.55;font-size:11px">Drag to orbit · hover bars</span>
    </div>
  `)

  // Tooltip
  _tip = tooltip()

  // Raycaster for bar hover
  const ray   = new Three.Raycaster()
  const mouse = new Three.Vector2(-9, -9)

  _onMove = (e) => {
    const el = ctx.renderer.domElement
    const r  = el.getBoundingClientRect()
    mouse.x =  ((e.clientX - r.left) / r.width)  * 2 - 1
    mouse.y = -((e.clientY - r.top)  / r.height) * 2 + 1
    ray.setFromCamera(mouse, ctx.camera)
    const hit = ray.intersectObjects(_bars)[0]
    if (hit) {
      const { city, month, temp } = hit.object.userData
      _tip.show(`${city}  ·  ${MONTHS[month]}\n${temp}°C`, e.clientX, e.clientY)
    } else {
      _tip.hide()
    }
  }
  window.addEventListener('mousemove', _onMove)
}

export function update(ctx, dt) {
  const t = ctx.elapsed
  for (const bar of _bars) {
    const { phase, baseH } = bar.userData
    // Gentle wave pulse: scale Y slightly, re-anchor bottom at y=0
    const s = 1 + 0.055 * Math.sin(t * 1.8 + phase)
    bar.scale.y    = s
    bar.position.y = baseH * s / 2
  }
}

export function teardown(ctx) {
  window.removeEventListener('mousemove', _onMove)

  for (const obj of _objects) {
    if (obj.geometry) obj.geometry.dispose()
    if (obj.material) obj.material.dispose()
    ctx.remove(obj)
  }
  for (const lbl of _labels) lbl.detach()

  _hud?.dispose()
  _tip?.dispose()

  _objects = []
  _bars    = []
  _labels  = []
  _hud     = null
  _tip     = null
  _onMove  = null
}
