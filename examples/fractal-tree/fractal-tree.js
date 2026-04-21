// fractal-tree.js — Recursive 3D L-system fractal tree that grows from a seed over time
import * as THREE from 'three'
import { cylinder, sphere } from '../../src/stdlib/geometry.js'

const MAX_LEVELS = 4
const GROWTH_DURATION = 10   // seconds for full tree to appear
const TRUNK_HEIGHT = 3.5
const TRUNK_RADIUS = 0.28

// Module-level refs so teardown can reach them
let rootGroup
let branches  // [{ cyl, branchGroup, spawnTime, windPhase, windAmp, isLeaf }]
let lights

// ---------------------------------------------------------------------------
// Tree construction
// ---------------------------------------------------------------------------

// Builds one branch inside pivotGroup (which already holds position + tilt).
// branchGroup is the wind-rotation target; cylinder mesh sits inside it.
function buildBranch(pivotGroup, length, radius, level, spawnTime) {
  const branchGroup = new THREE.Group()
  pivotGroup.add(branchGroup)

  const geo = cylinder(radius * 0.7, radius, length, 8)
  const mat = new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.92, metalness: 0.0 })
  const cyl = new THREE.Mesh(geo, mat)
  cyl.position.y = length / 2   // cylinder origin is at its center
  cyl.visible = false
  branchGroup.add(cyl)

  branches.push({
    cyl,
    branchGroup,
    spawnTime,
    windPhase: Math.random() * Math.PI * 2,
    windAmp: 0.01 * (level + 1),   // higher levels sway more
    isLeaf: false,
  })

  if (level < MAX_LEVELS) {
    // 3 main forks from trunk, 2–3 elsewhere with random jitter
    const numChildren = level === 0 ? 3 : (Math.random() > 0.4 ? 3 : 2)
    const childSpawn = spawnTime + GROWTH_DURATION / (MAX_LEVELS + 1)

    for (let i = 0; i < numChildren; i++) {
      // Spread children evenly in azimuth with random jitter
      const az = (i / numChildren) * Math.PI * 2 + (Math.random() - 0.5) * 0.7
      const tilt = 0.32 + Math.random() * 0.36   // angle from parent axis

      // childPivot carries position + tilt; branchGroup inside carries wind
      const childPivot = new THREE.Group()
      childPivot.position.y = length
      childPivot.rotation.set(Math.sin(az) * tilt, 0, Math.cos(az) * tilt)
      branchGroup.add(childPivot)

      buildBranch(childPivot, length * 0.65, radius * 0.65, level + 1, childSpawn)
    }
  } else {
    addLeaves(branchGroup, length, spawnTime + 1.0)
  }
}

function addLeaves(branchGroup, branchLength, spawnTime) {
  const leafGroup = new THREE.Group()
  leafGroup.position.y = branchLength
  leafGroup.visible = false
  branchGroup.add(leafGroup)

  const leafMat = new THREE.MeshStandardMaterial({
    color: 0x2d8a3e,
    transparent: true,
    opacity: 0.78,
    roughness: 0.8,
    depthWrite: false,
  })

  for (let j = 0; j < 8; j++) {
    const r = 0.1 + Math.random() * 0.09
    const leaf = new THREE.Mesh(sphere(r, 6), leafMat)
    leaf.position.set(
      (Math.random() - 0.5) * 0.7,
      (Math.random() - 0.5) * 0.5,
      (Math.random() - 0.5) * 0.7,
    )
    leafGroup.add(leaf)
  }

  branches.push({
    cyl: leafGroup,
    branchGroup: leafGroup,
    spawnTime,
    windPhase: Math.random() * Math.PI * 2,
    windAmp: 0.05,
    isLeaf: true,
  })
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export function setup(ctx) {
  branches = []
  lights = []

  ctx.camera.position.set(0, 5, 14)
  ctx.camera.lookAt(0, 4, 0)

  // Soft warm ambient + warm directional sun from above
  const ambient = new THREE.AmbientLight(0x7a9ab5, 0.75)
  ctx.add(ambient)
  lights.push(ambient)

  const sun = new THREE.DirectionalLight(0xfff5cc, 2.4)
  sun.position.set(6, 18, 8)
  sun.castShadow = true
  ctx.add(sun)
  lights.push(sun)

  // Single root group — teardown removes everything by removing this
  rootGroup = new THREE.Group()
  ctx.add(rootGroup)

  // Pivot at ground level; branchGroup inside handles wind
  const trunkPivot = new THREE.Group()
  rootGroup.add(trunkPivot)
  buildBranch(trunkPivot, TRUNK_HEIGHT, TRUNK_RADIUS, 0, 0)
}

export function update(ctx, dt) {   // eslint-disable-line no-unused-vars
  const elapsed = ctx.elapsed

  for (const b of branches) {
    // Progressive reveal as the tree grows
    if (!b.cyl.visible && elapsed >= b.spawnTime) {
      b.cyl.visible = true
    }

    // Wind sway: sinusoidal rotation on local Z (and a gentler X component).
    // Because groups are nested, sway compounds naturally up the hierarchy.
    if (!b.isLeaf) {
      b.branchGroup.rotation.z = Math.sin(elapsed * 1.5 + b.windPhase) * b.windAmp
      b.branchGroup.rotation.x = Math.sin(elapsed * 1.0 + b.windPhase * 1.7) * b.windAmp * 0.35
    } else {
      b.branchGroup.rotation.z = Math.sin(elapsed * 2.2 + b.windPhase) * b.windAmp
    }
  }
}

export function teardown(ctx) {
  for (const light of lights) ctx.remove(light)
  ctx.remove(rootGroup)
  lights = []
  branches = []
  rootGroup = null
}
