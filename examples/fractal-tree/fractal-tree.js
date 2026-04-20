// fractal-tree — recursive 3D cylinder branches swaying in simulated wind.
import * as Three from 'three'

const MAX_DEPTH  = 6
const TRUNK_LEN  = 2.4
const TRUNK_R    = 0.18
const LEN_SCALE  = 0.68
const RAD_SCALE  = 0.58
const BRANCH_ANG = 0.42  // radians from parent axis

function lerp(a, b, t) { return a + (b - a) * t }

function branchColor(depth) {
  const t = depth / MAX_DEPTH
  // brown (trunk) → green (tips)
  const r = lerp(0.42, 0.08, t)
  const g = lerp(0.22, 0.60, t)
  const b = lerp(0.08, 0.12, t)
  return new Three.Color(r, g, b)
}

function buildBranch(parent, depth, len, radius, col) {
  if (depth > MAX_DEPTH) return

  const geo = new Three.CylinderGeometry(radius * RAD_SCALE, radius, len, 7, 1)
  geo.translate(0, len / 2, 0)

  const mat = new Three.MeshStandardMaterial({
    color:    col,
    roughness: 0.85,
    metalness: 0.0,
  })
  const mesh = new Three.Mesh(geo, mat)
  parent.add(mesh)
  mesh.userData.depth = depth

  if (depth < MAX_DEPTH) {
    const childLen = len * LEN_SCALE
    const childRad = radius * RAD_SCALE
    const childCol = branchColor(depth + 1)
    const childCount = depth < 3 ? 3 : 2

    for (let i = 0; i < childCount; i++) {
      const twist = (i / childCount) * Math.PI * 2
      const pivot = new Three.Group()
      pivot.position.y = len
      pivot.rotation.y = twist
      pivot.rotation.z = BRANCH_ANG

      mesh.add(pivot)
      buildBranch(pivot, depth + 1, childLen, childRad, childCol)
    }
  }
}

export function setup(ctx) {
  ctx.camera.position.set(0, 5, 15)
  ctx.camera.lookAt(0, 4, 0)
  ctx.setBloom(0.4)

  const ambient = new Three.AmbientLight(0x223322, 1.2)
  const sun     = new Three.DirectionalLight(0xfff4dd, 1.4)
  sun.position.set(8, 20, 10)
  ctx.add(ambient)
  ctx.add(sun)

  const ground = new Three.Mesh(
    new Three.PlaneGeometry(40, 40),
    new Three.MeshStandardMaterial({ color: 0x1a2a0a, roughness: 1.0 }),
  )
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -0.1
  ctx.add(ground)

  // Root group — wind sway applied here
  ctx._root = new Three.Group()
  ctx.add(ctx._root)

  buildBranch(ctx._root, 0, TRUNK_LEN, TRUNK_R, branchColor(0))

  // Collect all branch meshes for sway animation
  ctx._branches = []
  ctx._root.traverse(obj => { if (obj.isMesh) ctx._branches.push(obj) })

  ctx._objects = [ambient, sun, ground, ctx._root]
}

export function update(ctx, dt) {
  const t = ctx.elapsed

  // Whole-tree sway
  ctx._root.rotation.z = Math.sin(t * 0.7) * 0.06
  ctx._root.rotation.x = Math.sin(t * 0.5 + 1.2) * 0.04

  // Depth-dependent secondary sway
  for (const branch of ctx._branches) {
    const depth = branch.userData.depth
    const factor = depth / MAX_DEPTH
    const sway = Math.sin(t * 1.3 + depth * 0.9) * 0.04 * factor
    branch.rotation.z = sway
  }
}

export function teardown(ctx) {
  for (const obj of ctx._objects) ctx.remove(obj)
}
