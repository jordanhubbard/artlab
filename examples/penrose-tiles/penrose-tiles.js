// penrose-tiles — Penrose P3 (rhombus) aperiodic tiling via deflation.
import * as Three from 'three'

const PHI = (1 + Math.sqrt(5)) / 2
const GENERATIONS = 5
const TILE_GAP = 0.02
const ANIM_SPEED = 0.3

// Triangle types: 0 = thin (36°), 1 = thick (72°)
// Each triangle: { type, a, b, c } where a,b,c are [x,y]

function subdivide(triangles) {
  const result = []
  for (const t of triangles) {
    const { type, a, b, c } = t
    if (type === 0) {
      // Thin triangle — split into 1 thin + 1 thick
      const p = lerp2(a, b, 1 / PHI)
      result.push({ type: 0, a: c, b: p, c: b })
      result.push({ type: 1, a: p, b: c, c: a })
    } else {
      // Thick triangle — split into 2 thick + 1 thin
      const q = lerp2(b, a, 1 / PHI)
      const r = lerp2(b, c, 1 / PHI)
      result.push({ type: 1, a: q, b: r, c: b })
      result.push({ type: 1, a: r, b: q, c: a })
      result.push({ type: 0, a: r, b: c, c: a })
    }
  }
  return result
}

function lerp2(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
}

function initialWheel() {
  // 10 triangles in a decagon (sun configuration)
  const tris = []
  for (let i = 0; i < 10; i++) {
    const angle1 = (2 * Math.PI * i) / 10
    const angle2 = (2 * Math.PI * (i + 1)) / 10
    const R = 6
    const b = [R * Math.cos(angle1), R * Math.sin(angle1)]
    const c = [R * Math.cos(angle2), R * Math.sin(angle2)]
    if (i % 2 === 0) {
      tris.push({ type: 1, a: [0, 0], b, c })
    } else {
      tris.push({ type: 1, a: [0, 0], b: c, c: b })
    }
  }
  return tris
}

function buildTileMeshes(triangles) {
  // Group pairs of triangles into rhombi by centroid proximity, then build meshes
  // Simpler: just render each triangle as a filled shape
  const meshes = []
  for (let i = 0; i < triangles.length; i++) {
    const t = triangles[i]
    const geo = new Three.BufferGeometry()
    const cx = (t.a[0] + t.b[0] + t.c[0]) / 3
    const cy = (t.a[1] + t.b[1] + t.c[1]) / 3
    const shrink = 1 - TILE_GAP
    const verts = new Float32Array([
      cx + (t.a[0] - cx) * shrink, 0, cy + (t.a[1] - cy) * shrink,
      cx + (t.b[0] - cx) * shrink, 0, cy + (t.b[1] - cy) * shrink,
      cx + (t.c[0] - cx) * shrink, 0, cy + (t.c[1] - cy) * shrink,
    ])
    geo.setAttribute('position', new Three.Float32BufferAttribute(verts, 3))
    geo.computeVertexNormals()

    const hue = t.type === 0
      ? 0.55 + (i / triangles.length) * 0.15  // thin: blue-cyan
      : 0.0 + (i / triangles.length) * 0.12   // thick: red-orange
    const mat = new Three.MeshStandardMaterial({
      color: new Three.Color().setHSL(hue, 0.65, 0.5),
      side: Three.DoubleSide,
      roughness: 0.4, metalness: 0.2,
    })
    const mesh = new Three.Mesh(geo, mat)
    mesh.position.y = 0
    mesh._targetY = 0
    mesh._birthTime = i * 0.002  // stagger animation
    meshes.push(mesh)
  }
  return meshes
}

export function setup(ctx) {
  ctx.camera.position.set(0, 12, 4)
  ctx.camera.lookAt(0, 0, 0)
  ctx.setBloom(0.3)

  const ambient = new Three.AmbientLight(0x556677, 1.0)
  ctx.add(ambient)
  const sun = new Three.DirectionalLight(0xffffff, 1.2)
  sun.position.set(3, 15, 5)
  ctx.add(sun)
  ctx._lights = [ambient, sun]

  // Generate tiling
  let tris = initialWheel()
  for (let g = 0; g < GENERATIONS; g++) {
    tris = subdivide(tris)
  }
  ctx._triangles = tris

  // Build meshes
  ctx._tileMeshes = buildTileMeshes(tris)
  for (const m of ctx._tileMeshes) {
    m.position.y = -5  // start below
    ctx.add(m)
  }

  ctx._animTime = 0
  ctx._colorPhase = 0
}

export function update(ctx, dt) {
  const dt_ = Math.min(dt, 0.05)
  ctx._animTime += dt_
  ctx._colorPhase += dt_ * 0.1

  for (let i = 0; i < ctx._tileMeshes.length; i++) {
    const m = ctx._tileMeshes[i]
    // Rise-in animation
    const age = ctx._animTime - m._birthTime
    if (age > 0) {
      const target = 0
      m.position.y += (target - m.position.y) * Math.min(1, dt_ * 3)
    }

    // Gentle color cycling
    const t = ctx._triangles[i]
    const baseHue = t.type === 0 ? 0.55 : 0.0
    const hue = (baseHue + ctx._colorPhase + i * 0.0003) % 1
    m.material.color.setHSL(hue, 0.65, 0.5)
  }
}

export function teardown(ctx) {
  for (const m of ctx._tileMeshes) {
    ctx.remove(m)
    m.geometry.dispose()
    m.material.dispose()
  }
  for (const l of ctx._lights) ctx.remove(l)
}
