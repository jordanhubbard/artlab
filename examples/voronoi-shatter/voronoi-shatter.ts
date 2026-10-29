// voronoi-shatter — click to place seeds; plane shatters into Voronoi cells with physics.
import * as Three from 'three'

const PLANE_SIZE = 10
const GRAVITY    = -12
const INITIAL_SEEDS = 8
const MAX_SEEDS  = 40

// Brute-force 2D Voronoi via clipped convex polygons
function voronoiCells(seeds, bounds) {
  const { minX, maxX, minY, maxY } = bounds
  const cells = []

  for (let i = 0; i < seeds.length; i++) {
    // Start with bounding rectangle as polygon
    let poly = [
      [minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY],
    ]

    for (let j = 0; j < seeds.length; j++) {
      if (i === j) continue
      // Clip polygon by the half-plane closer to seed i than seed j
      const mx = (seeds[i][0] + seeds[j][0]) / 2
      const my = (seeds[i][1] + seeds[j][1]) / 2
      const nx = seeds[i][0] - seeds[j][0]
      const ny = seeds[i][1] - seeds[j][1]
      poly = clipPolygon(poly, mx, my, nx, ny)
      if (poly.length < 3) break
    }

    if (poly.length >= 3) {
      cells.push({ seed: seeds[i], verts: poly })
    }
  }
  return cells
}

function clipPolygon(poly, px, py, nx, ny) {
  const out = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const da = (a[0] - px) * nx + (a[1] - py) * ny
    const db = (b[0] - px) * nx + (b[1] - py) * ny
    if (da >= 0) out.push(a)
    if ((da >= 0) !== (db >= 0)) {
      const t = da / (da - db)
      out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])])
    }
  }
  return out
}

function cellToMesh(cell, hue) {
  const shape = new Three.Shape()
  const cx = cell.seed[0]
  const cy = cell.seed[1]
  const v = cell.verts
  shape.moveTo(v[0][0] - cx, v[0][1] - cy)
  for (let i = 1; i < v.length; i++) {
    shape.lineTo(v[i][0] - cx, v[i][1] - cy)
  }
  shape.closePath()

  const depth = 0.15 + Math.random() * 0.2
  const geo = new Three.ExtrudeGeometry(shape, {
    depth, bevelEnabled: false,
  })
  const mat = new Three.MeshStandardMaterial({
    color: new Three.Color().setHSL(hue, 0.6, 0.5),
    roughness: 0.5, metalness: 0.3,
  })
  const mesh = new Three.Mesh(geo, mat)
  mesh.position.set(cx, 0, cy)
  mesh.rotation.x = -Math.PI / 2
  return mesh
}

export function setup(ctx) {
  ctx.setHelp('Click to drop a seed point — each new seed shatters the plane into more cells')
  ctx.camera.position.set(0, 12, 8)
  ctx.camera.lookAt(0, 0, 0)
  ctx.setBloom(0.4)

  const ambient = new Three.AmbientLight(0x334455, 1.2)
  ctx.add(ambient)
  const sun = new Three.DirectionalLight(0xffffff, 1.5)
  sun.position.set(5, 15, 10)
  ctx.add(sun)
  ctx._lights = [ambient, sun]

  ctx._seeds = []
  ctx._cellMeshes = []
  ctx._physics = [] // { mesh, vx, vy, vz, rx, ry, rz, fallen }
  ctx._shattered = false

  // Initial seeds scattered
  const hs = PLANE_SIZE / 2
  for (let i = 0; i < INITIAL_SEEDS; i++) {
    ctx._seeds.push([
      (Math.random() - 0.5) * PLANE_SIZE * 0.8,
      (Math.random() - 0.5) * PLANE_SIZE * 0.8,
    ])
  }

  rebuildCells(ctx)

  // Raycaster for click interaction
  ctx._raycaster = new Three.Raycaster()
  ctx._mouse = new Three.Vector2()
  ctx._clickPlane = new Three.Plane(new Three.Vector3(0, 1, 0), 0)

  ctx._onClick = (e) => {
    const rect = ctx.renderer.domElement.getBoundingClientRect()
    ctx._mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    ctx._mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    ctx._raycaster.setFromCamera(ctx._mouse, ctx.camera)

    const hit = new Three.Vector3()
    ctx._raycaster.ray.intersectPlane(ctx._clickPlane, hit)
    if (hit && ctx._seeds.length < MAX_SEEDS) {
      ctx._seeds.push([hit.x, hit.z])
      // Trigger shatter
      ctx._shattered = true
      shatter(ctx)
    }
  }
  ctx.renderer.domElement.addEventListener('click', ctx._onClick)
}

function rebuildCells(ctx) {
  // Remove old
  for (const m of ctx._cellMeshes) ctx.remove(m)
  ctx._cellMeshes = []
  ctx._physics = []

  const hs = PLANE_SIZE / 2
  const bounds = { minX: -hs, maxX: hs, minY: -hs, maxY: hs }
  const cells = voronoiCells(ctx._seeds, bounds)

  for (let i = 0; i < cells.length; i++) {
    const hue = i / cells.length
    const mesh = cellToMesh(cells[i], hue)
    ctx.add(mesh)
    ctx._cellMeshes.push(mesh)
    ctx._physics.push({
      mesh,
      vx: 0, vy: 0, vz: 0,
      rx: 0, ry: 0, rz: 0,
      fallen: false,
    })
  }
}

function shatter(ctx) {
  // Give each cell an outward velocity
  for (const p of ctx._physics) {
    const dx = p.mesh.position.x
    const dz = p.mesh.position.z
    const dist = Math.sqrt(dx * dx + dz * dz) + 0.5
    p.vx = (dx / dist) * (2 + Math.random() * 3)
    p.vy = 3 + Math.random() * 5
    p.vz = (dz / dist) * (2 + Math.random() * 3)
    p.rx = (Math.random() - 0.5) * 4
    p.ry = (Math.random() - 0.5) * 4
    p.rz = (Math.random() - 0.5) * 4
    p.fallen = false
  }
}

export function update(ctx, dt) {
  if (!ctx._shattered) return
  const dt_ = Math.min(dt, 0.05)

  for (const p of ctx._physics) {
    if (p.fallen) continue
    p.vy += GRAVITY * dt_
    p.mesh.position.x += p.vx * dt_
    p.mesh.position.y += p.vy * dt_
    p.mesh.position.z += p.vz * dt_
    p.mesh.rotation.x += p.rx * dt_
    p.mesh.rotation.y += p.ry * dt_
    p.mesh.rotation.z += p.rz * dt_

    if (p.mesh.position.y < -15) {
      p.fallen = true
    }
  }
}

export function teardown(ctx) {
  ctx.renderer.domElement.removeEventListener('click', ctx._onClick)
  for (const m of ctx._cellMeshes) {
    ctx.remove(m)
    m.geometry.dispose()
    m.material.dispose()
  }
  for (const l of ctx._lights) ctx.remove(l)
}
