// Generative printable vessel — stacked CSG shells, tide-pool windows, barnacle helix.
// Convention: 1 artlab unit = 1 mm.
import * as Three from 'three'
import { STLExporter } from 'three/addons/exporters/STLExporter.js'
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js'
import ManifoldModule from 'manifold-3d'

const HEIGHT = 90
const SLICES = 12
const WALL = 1.6

let wasm = null
let previewMesh = null
let added = []
let ui = null
let params = { seed: 1, waves: 5, barnacles: 28, windows: 7 }

function rng(seed) {
  let s = (seed >>> 0) || 1
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

async function initManifold() {
  if (wasm) return wasm
  wasm = await ManifoldModule()
  wasm.setup()
  return wasm
}

function radiusAt(z, waves, rand) {
  const t = z / HEIGHT
  const belly = 15 + 13 * Math.sin(Math.PI * t)
  const ripple = 2.4 * Math.sin(waves * Math.PI * 2 * t + rand() * 2)
  const foot = t < 0.07 ? 6 : 0
  return Math.max(7.5, belly + ripple + foot)
}

function buildVessel(p) {
  const { Manifold } = wasm
  const rand = rng(p.seed)
  const sliceH = HEIGHT / SLICES
  const temps = []

  let body = null
  for (let i = 0; i < SLICES; i++) {
    const z0 = i * sliceH
    const r0 = radiusAt(z0, p.waves, rand)
    const r1 = radiusAt(z0 + sliceH, p.waves, rand)
    const outer = Manifold.cylinder(sliceH, r0, r1, 40, false)
      .translate([0, 0, z0])
    const inner = Manifold.cylinder(sliceH + 0.5, Math.max(3.2, r0 - WALL), Math.max(3.2, r1 - WALL), 40, false)
      .translate([0, 0, z0 - 0.2])
    const shell = outer.subtract(inner)
    temps.push(outer, inner)
    if (!body) {
      body = shell
    } else {
      const next = body.add(shell)
      temps.push(body, shell)
      body = next
    }
  }

  for (let w = 0; w < p.windows; w++) {
    const t = 0.22 + (w / p.windows) * 0.55
    const z = t * HEIGHT
    const ang = (w * 2.399) + p.seed * 0.17
    const r = radiusAt(z, p.waves, rand)
    const hole = Manifold.cylinder(r * 2.4, 2.1, 1.6, 20, true)
      .rotate([0, 90, 0])
      .rotate([0, 0, (ang * 180) / Math.PI])
      .translate([0, 0, z])
    const next = body.subtract(hole)
    temps.push(body, hole)
    body = next
  }

  for (let b = 0; b < p.barnacles; b++) {
    const t = b / p.barnacles
    const z = 10 + t * 68
    const ang = t * Math.PI * 6.2 + p.seed
    const r = radiusAt(z, p.waves, rand) + 0.4
    const rad = 1.1 + rand() * 1.4
    const nod = Manifold.sphere(rad, 16)
      .translate([Math.cos(ang) * r, Math.sin(ang) * r, z])
    const next = body.add(nod)
    temps.push(body, nod)
    body = next
  }

  const foot = Manifold.cylinder(5, 22, 18, 40, false)
  const chamfer = Manifold.cylinder(6, 0.2, 16, 32, false).translate([0, 0, 2.4])
  const footSolid = foot.subtract(chamfer)
  const next = body.add(footSolid)
  temps.push(body, foot, chamfer, footSolid)
  body = next

  const upright = body.rotate([-90, 0, 0])
  temps.push(body)
  temps.forEach(m => { try { m.delete() } catch (_) { /* already consumed */ } })
  return upright
}

function manifoldToGeometry(man) {
  const m = man.getMesh()
  const geo = new Three.BufferGeometry()
  geo.setAttribute('position', new Three.BufferAttribute(m.vertProperties.slice(), 3))
  geo.setIndex(new Three.BufferAttribute(m.triVerts.slice(), 1))
  geo.computeVertexNormals()
  return geo
}

function download(filename, data, mime) {
  const blob = new Blob([data], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function makeUI(container, onSTL, onOBJ, onReseed) {
  const panel = document.createElement('div')
  panel.style.cssText = [
    'position:absolute', 'top:16px', 'right:16px', 'z-index:100',
    'display:flex', 'gap:8px', 'flex-wrap:wrap', 'justify-content:flex-end',
    'font-family:monospace', 'font-size:12px',
  ].join(';')

  const mkBtn = (label, onClick) => {
    const b = document.createElement('button')
    b.textContent = label
    b.style.cssText = [
      'padding:8px 12px', 'background:#1a1a2a', 'color:#aaccff',
      'border:1px solid #4466ff', 'border-radius:4px',
      'cursor:pointer', 'font-family:inherit', 'font-size:inherit',
    ].join(';')
    b.addEventListener('click', onClick)
    return b
  }

  panel.appendChild(mkBtn('Export STL', onSTL))
  panel.appendChild(mkBtn('Export OBJ', onOBJ))
  panel.appendChild(mkBtn('Reseed', onReseed))
  container.appendChild(panel)
  return panel
}

function applyPreviewGeo(ctx, geo) {
  if (previewMesh) {
    previewMesh.geometry.dispose()
    previewMesh.geometry = geo
    return
  }
  const mat = new Three.MeshStandardMaterial({
    color: 0xc4a882, metalness: 0.12, roughness: 0.55,
  })
  previewMesh = new Three.Mesh(geo, mat)
  ctx.add(previewMesh)
  added.push(previewMesh)
}

async function rebuild(ctx) {
  const vessel = buildVessel(params)
  const geo = manifoldToGeometry(vessel)
  vessel.delete()
  applyPreviewGeo(ctx, geo)
}

export async function setup(ctx) {
  ctx.setHelp('Reseed grows a new specimen  •  Export STL / OBJ for printing (1 unit = 1 mm)')
  ctx.setBloom(0.25)
  ctx.camera.position.set(70, 55, 110)
  ctx.camera.lookAt(0, 30, 0)
  if (ctx.controls) {
    ctx.controls.target.set(0, 30, 0)
    ctx.controls.update?.()
  }

  const amb = new Three.AmbientLight(0xfff2e0, 0.4)
  ctx.add(amb)
  added.push(amb)
  const key = new Three.DirectionalLight(0xffe6c8, 1.8)
  key.position.set(80, 140, 60)
  ctx.add(key)
  added.push(key)
  const fill = new Three.DirectionalLight(0x6688aa, 0.55)
  fill.position.set(-50, 30, -40)
  ctx.add(fill)
  added.push(fill)

  const grid = new Three.GridHelper(200, 20, 0x335577, 0x112233)
  grid.position.y = -0.05
  ctx.add(grid)
  added.push(grid)

  await initManifold()
  await rebuild(ctx)

  const container = ctx.renderer.domElement.parentElement
  container.style.position = 'relative'
  ui = makeUI(
    container,
    () => download('tide-eroded-vessel.stl', new STLExporter().parse(previewMesh, { binary: true }), 'application/octet-stream'),
    () => download('tide-eroded-vessel.obj', new OBJExporter().parse(previewMesh), 'text/plain'),
    async () => {
      params = { ...params, seed: params.seed + 1 }
      await rebuild(ctx)
    },
  )
}

export function update(_ctx, dt) {
  if (previewMesh) previewMesh.rotation.y += 0.18 * dt
}

export function teardown(ctx) {
  for (const obj of added) ctx.remove(obj)
  added = []
  previewMesh = null
  ui?.remove()
  ui = null
}
