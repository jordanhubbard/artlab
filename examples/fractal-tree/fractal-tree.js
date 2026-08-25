// fractal-tree.js — "Old Growth": a ground-level view beneath an ancient canopy.
//
// The recursion still drives everything, but it is evaluated once at setup into
// flat instance-matrix arrays: a stout tapered trunk, buttress roots, six
// arching limbs, and a dense instanced canopy carried by those limbs. Wind is
// applied at the trunk and limb joints only, so the leaves of a limb always sway
// with the wood that holds them and per-frame work stays constant.

import * as THREE from 'three'

const TAU = Math.PI * 2
const SEED = 20260825

// Tree proportions, world units, ground at y = 0
const TRUNK_HEIGHT = 6.4
const TRUNK_RADIUS = 0.82
const TRUNK_SEGMENTS = 4
const SEGMENT_TAPER = 0.88          // radius ratio between stacked segments
const LIMB_COUNT = 6
const LIMB_LENGTH = 3.4
const LIMB_RADIUS_FACTOR = 0.46     // limb base radius relative to the trunk
const BRANCH_DEPTH = 4
const SEGMENTS_PER_BRANCH = 2
const CHILD_LENGTH_FALLOFF = 0.66
const CHILD_RADIUS_FALLOFF = 0.92
const LEAVES_PER_TIP = 8

// Forest staging
const ROOT_PAIRS = 9
const UNDERSTORY_COUNT = 180
const DISTANT_TRUNK_COUNT = 40
const SHAFT_COUNT = 3
const FLOOR_SIZE = 160
const FOG_COLOR = 0x384631
const FOG_DENSITY = 0.024

// Motion — deliberately restrained; this is a very old, very heavy tree
const TRUNK_SWAY = 0.006
const LIMB_SWAY_MIN = 0.016
const LIMB_SWAY_RANGE = 0.014
const CAMERA_RADIUS = 7.6
const CAMERA_HEIGHT = 1.5
const CAMERA_TARGET_Y = 3.7

let _objects = []                   // top-level objects handed to ctx.add
let _limbs = []                     // [{ anchor, wind, branches, canopy, ... }]
let _pools = []
let _shafts = []
let _trunkWind = null
let _prevFog = null
let _prevBackground = null
let _prevControlsEnabled = true
let _active = false

// ---------------------------------------------------------------------------
// Deterministic sampling
// ---------------------------------------------------------------------------

// Linear congruential generator: the same seed always grows the same tree, so
// the composition is reproducible across reloads and test runs.
function makeRandom(seed) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

function translation(x, y, z) {
  return new THREE.Matrix4().makeTranslation(x, y, z)
}

function scaling(x, y, z) {
  return new THREE.Matrix4().makeScale(x, y, z)
}

// Gentle ground relief, flattened near the trunk so the roots meet solid floor.
// Sampled in the floor plane's own coordinates (u, v).
function floorRelief(u, v) {
  const radius = Math.hypot(u, v)
  const mask = Math.min(1, Math.max(0, (radius - 4) / 8))
  const relief = Math.sin(u * 0.16) * Math.cos(v * 0.13) * 0.55
    + Math.sin(u * 0.05 + v * 0.07) * 0.9
  return relief * mask
}

// Ground height at a world position. Rotating the floor plane by -90° about X
// maps plane v to -z, so anything placed on the ground must sample it that way
// or it ends up hovering above or sunk into the relief.
function groundHeight(x, z) {
  return floorRelief(x, -z)
}

// ---------------------------------------------------------------------------
// Branch generation — pure matrix math, no scene objects
// ---------------------------------------------------------------------------

/**
 * Walks `count` tapered segments along the frame's +Y axis, bending a little at
 * every joint so limbs arch instead of running straight.
 *
 * Returns the segment instance matrices, the frame at every joint, and the
 * frame plus radius at the tip.
 */
function growChain(startFrame, length, radius, count, bend, twist) {
  const segmentLength = length / count
  const matrices = []
  const joints = []
  const frame = startFrame.clone()
  let segmentRadius = radius

  for (let i = 0; i < count; i++) {
    matrices.push(frame.clone().multiply(scaling(segmentRadius, segmentLength, segmentRadius)))
    frame.multiply(translation(0, segmentLength, 0))
    frame.multiply(new THREE.Matrix4().makeRotationZ(bend))
    frame.multiply(new THREE.Matrix4().makeRotationY(twist))
    segmentRadius *= SEGMENT_TAPER
    joints.push(frame.clone())
  }

  return { matrices, joints, tip: frame, tipRadius: segmentRadius }
}

// Recursively grows one branch and its children into `out.branches` (instance
// matrices) and `out.tips` (leaf-bearing twig frames).
function growBranch(frame, length, radius, depth, rand, out) {
  const bend = (rand() - 0.5) * 0.24
  const twist = (rand() - 0.5) * 0.3
  const chain = growChain(frame, length, radius, SEGMENTS_PER_BRANCH, bend, twist)
  for (const matrix of chain.matrices) out.branches.push(matrix)

  if (depth === 0) {
    out.tips.push({ frame: chain.tip, radius: chain.tipRadius })
    out.tipRadius = Math.min(out.tipRadius, chain.tipRadius)
    return
  }

  const children = rand() < 0.45 ? 3 : 2
  for (let i = 0; i < children; i++) {
    const azimuth = (i / children) * TAU + rand() * 0.8
    const tilt = 0.30 + rand() * 0.34
    const childFrame = chain.tip.clone()
      .multiply(new THREE.Matrix4().makeRotationY(azimuth))
      .multiply(new THREE.Matrix4().makeRotationX(tilt))
    growBranch(
      childFrame,
      length * CHILD_LENGTH_FALLOFF,
      chain.tipRadius * CHILD_RADIUS_FALLOFF,
      depth - 1,
      rand,
      out,
    )
  }
}

// Clusters flattened leaf blobs around each twig tip, in that twig's own frame.
function scatterLeaves(tips, rand) {
  const matrices = []
  for (const tip of tips) {
    const spread = 0.5 + tip.radius * 7
    for (let i = 0; i < LEAVES_PER_TIP; i++) {
      const scale = 0.28 + rand() * 0.26
      matrices.push(tip.frame.clone()
        .multiply(translation(
          (rand() - 0.5) * spread,
          rand() * 1.15 - 0.2,
          (rand() - 0.5) * spread,
        ))
        .multiply(new THREE.Matrix4().makeRotationY(rand() * TAU))
        .multiply(scaling(scale * 1.7, scale * 0.6, scale * 1.7)))
    }
  }
  return matrices
}

// ---------------------------------------------------------------------------
// Shared resources
// ---------------------------------------------------------------------------

// One unit trunk/branch segment: base at the origin, unit height, bottom radius
// 1 tapering to SEGMENT_TAPER at the top. Every piece of wood in the scene is
// this geometry under a different instance matrix.
function makeWoodGeometry() {
  const geometry = new THREE.CylinderGeometry(SEGMENT_TAPER, 1, 1, 7)
  geometry.translate(0, 0.5, 0)
  return geometry
}

// Root geometry flares harder than a branch so buttresses read as buttresses.
function makeRootGeometry() {
  const geometry = new THREE.CylinderGeometry(0.34, 1, 1, 6)
  geometry.translate(0, 0.5, 0)
  return geometry
}

// Canvas textures degrade to an undrawn texture when no 2D context exists
// (headless test environments), which keeps setup on one code path.
function makeLitterTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const g = canvas.getContext('2d')
  if (g) {
    g.fillStyle = '#2b2418'
    g.fillRect(0, 0, 256, 256)
    const rand = makeRandom(SEED + 7)
    for (let i = 0; i < 900; i++) {
      const shade = Math.floor(40 + rand() * 60)
      g.fillStyle = `rgb(${shade + 22},${shade + 12},${Math.floor(shade * 0.55)})`
      g.beginPath()
      g.ellipse(rand() * 256, rand() * 256, 1.5 + rand() * 4, 1 + rand() * 2, rand() * TAU, 0, TAU)
      g.fill()
    }
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(10, 10)
  return texture
}

function makeGlowTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const g = canvas.getContext('2d')
  if (g) {
    const gradient = g.createRadialGradient(64, 64, 0, 64, 64, 64)
    gradient.addColorStop(0, 'rgba(255,238,190,0.95)')
    gradient.addColorStop(0.45, 'rgba(255,226,150,0.35)')
    gradient.addColorStop(1, 'rgba(255,220,140,0)')
    g.fillStyle = gradient
    g.fillRect(0, 0, 128, 128)
  }
  return new THREE.CanvasTexture(canvas)
}

function makeShaftTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 8
  canvas.height = 128
  const g = canvas.getContext('2d')
  if (g) {
    const gradient = g.createLinearGradient(0, 0, 0, 128)
    gradient.addColorStop(0, 'rgba(255,244,206,0.85)')
    gradient.addColorStop(0.7, 'rgba(255,236,180,0.22)')
    gradient.addColorStop(1, 'rgba(255,230,170,0)')
    g.fillStyle = gradient
    g.fillRect(0, 0, 8, 128)
  }
  return new THREE.CanvasTexture(canvas)
}

// ---------------------------------------------------------------------------
// Scene assembly
// ---------------------------------------------------------------------------

function track(ctx, object) {
  ctx.add(object)
  _objects.push(object)
  return object
}

function buildTree(rand, woodGeometry, rootGeometry, leafGeometry) {
  const grove = new THREE.Group()
  grove.name = 'old-growth'

  const barkMaterial = new THREE.MeshStandardMaterial({
    color: 0x4a3a2b, roughness: 0.95, metalness: 0.0,
  })

  _trunkWind = new THREE.Group()
  _trunkWind.name = 'trunk-wind'
  grove.add(_trunkWind)

  // Trunk: one chain of tapered segments, leaning almost imperceptibly.
  const trunk = growChain(
    new THREE.Matrix4(), TRUNK_HEIGHT, TRUNK_RADIUS, TRUNK_SEGMENTS, 0.012, 0.05,
  )
  const trunkMesh = new THREE.InstancedMesh(woodGeometry, barkMaterial, trunk.matrices.length)
  trunkMesh.name = 'trunk'
  trunk.matrices.forEach((matrix, i) => trunkMesh.setMatrixAt(i, matrix))
  _trunkWind.add(trunkMesh)

  // Limbs: two per attachment joint on the upper three trunk segments, so the
  // canopy spreads wide and low limbs reach out over the camera.
  const attachJoints = [1, 2, 3]
  let branchCount = trunk.matrices.length
  let leafCount = 0
  let tipRadius = Infinity
  let canopyBaseY = Infinity
  let canopyTopY = -Infinity
  let canopyRadius = 0
  const leafPoint = new THREE.Vector3()

  for (let i = 0; i < LIMB_COUNT; i++) {
    const jointIndex = attachJoints[i % attachJoints.length]
    const height = jointIndex / TRUNK_SEGMENTS
    const attachRadius = TRUNK_RADIUS * Math.pow(SEGMENT_TAPER, jointIndex + 1)
    const azimuth = (i / LIMB_COUNT) * TAU + rand() * 0.5
    const tilt = 0.95 - height * 0.5 + rand() * 0.12

    const anchor = new THREE.Group()
    anchor.name = `limb-anchor-${i}`
    anchor.matrixAutoUpdate = false
    anchor.matrix.copy(trunk.joints[jointIndex])
    anchor.matrix
      .multiply(new THREE.Matrix4().makeRotationY(azimuth))
      .multiply(new THREE.Matrix4().makeRotationX(tilt))
    _trunkWind.add(anchor)

    const wind = new THREE.Group()
    wind.name = `limb-wind-${i}`
    anchor.add(wind)

    const out = { branches: [], tips: [], tipRadius: Infinity }
    growBranch(
      new THREE.Matrix4(),
      LIMB_LENGTH * (1.12 - height * 0.28),
      attachRadius * LIMB_RADIUS_FACTOR,
      BRANCH_DEPTH,
      rand,
      out,
    )
    const leafMatrices = scatterLeaves(out.tips, rand)

    const branches = new THREE.InstancedMesh(woodGeometry, barkMaterial, out.branches.length)
    branches.name = `limb-branches-${i}`
    out.branches.forEach((matrix, k) => branches.setMatrixAt(k, matrix))
    wind.add(branches)

    const leafMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.85, metalness: 0.0, side: THREE.DoubleSide,
    })
    const canopy = new THREE.InstancedMesh(leafGeometry, leafMaterial, leafMatrices.length)
    canopy.name = `limb-canopy-${i}`
    const leafTint = new THREE.Color()
    leafMatrices.forEach((matrix, k) => {
      canopy.setMatrixAt(k, matrix)
      // Instance tint: sunlit yellow-greens through to deep shade greens.
      leafTint.setHSL(0.26 + rand() * 0.06, 0.42 + rand() * 0.22, 0.14 + rand() * 0.24)
      canopy.setColorAt(k, leafTint)

      // Track where the canopy actually sits so the camera can be staged
      // underneath it rather than at an arbitrary distance.
      leafPoint.setFromMatrixPosition(matrix).applyMatrix4(anchor.matrix)
      canopyBaseY = Math.min(canopyBaseY, leafPoint.y)
      canopyTopY = Math.max(canopyTopY, leafPoint.y)
      canopyRadius = Math.max(canopyRadius, Math.hypot(leafPoint.x, leafPoint.z))
    })
    wind.add(canopy)

    branchCount += out.branches.length
    leafCount += leafMatrices.length
    tipRadius = Math.min(tipRadius, out.tipRadius)

    _limbs.push({
      anchor,
      wind,
      branches,
      canopy,
      windAmp: LIMB_SWAY_MIN + rand() * LIMB_SWAY_RANGE,
      windFreq: 0.5 + rand() * 0.45,
      windPhase: rand() * TAU,
    })
  }

  // Buttress roots: a steep flare off the trunk plus a surface root running on.
  const rootMaterial = new THREE.MeshStandardMaterial({
    color: 0x3f3225, roughness: 0.97, metalness: 0.0,
  })
  const roots = new THREE.InstancedMesh(rootGeometry, rootMaterial, ROOT_PAIRS * 2)
  roots.name = 'old-growth-roots'
  const up = new THREE.Vector3(0, 1, 0)
  const start = new THREE.Vector3()
  const end = new THREE.Vector3()
  const direction = new THREE.Vector3()
  const orientation = new THREE.Quaternion()
  const stretch = new THREE.Vector3()
  const matrix = new THREE.Matrix4()
  let rootSpread = 0

  for (let i = 0; i < ROOT_PAIRS; i++) {
    const azimuth = (i / ROOT_PAIRS) * TAU + rand() * 0.3
    const flareTop = 0.9 + rand() * 0.85
    const flareOut = 1.7 + rand() * 1.2
    const runOut = flareOut + 1.4 + rand() * 1.6
    const thickness = 0.30 + rand() * 0.16

    start.set(Math.cos(azimuth) * TRUNK_RADIUS * 0.6, flareTop, Math.sin(azimuth) * TRUNK_RADIUS * 0.6)
    end.set(Math.cos(azimuth) * flareOut, -0.12, Math.sin(azimuth) * flareOut)
    direction.subVectors(end, start)
    stretch.set(thickness, direction.length(), thickness)
    orientation.setFromUnitVectors(up, direction.normalize())
    roots.setMatrixAt(i * 2, matrix.compose(start, orientation, stretch))

    const drift = azimuth + (rand() - 0.5) * 0.4
    start.copy(end)
    end.set(Math.cos(drift) * runOut, -0.24, Math.sin(drift) * runOut)
    direction.subVectors(end, start)
    stretch.set(thickness * 0.72, direction.length(), thickness * 0.72)
    orientation.setFromUnitVectors(up, direction.normalize())
    roots.setMatrixAt(i * 2 + 1, matrix.compose(start, orientation, stretch))

    rootSpread = Math.max(rootSpread, runOut)
  }
  grove.add(roots)

  return {
    grove,
    roots,
    stats: {
      branchCount,
      leafCount,
      limbCount: LIMB_COUNT,
      rootCount: ROOT_PAIRS * 2,
      rootSpread,
      trunkRadius: TRUNK_RADIUS,
      tipRadius,
      canopyBaseY,
      canopyTopY,
      canopyRadius,
    },
  }
}

function buildFloor(litterTexture) {
  const geometry = new THREE.PlaneGeometry(FLOOR_SIZE, FLOOR_SIZE, 48, 48)
  const position = geometry.attributes.position
  for (let i = 0; i < position.count; i++) {
    position.setZ(i, floorRelief(position.getX(i), position.getY(i)))
  }
  geometry.computeVertexNormals()

  const floor = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    color: 0x6a5c3e, roughness: 0.98, metalness: 0.0, map: litterTexture,
  }))
  floor.name = 'forest-floor'
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -0.02
  return floor
}

// Low ferns and shrub clumps, reusing the canopy leaf blob so the understory
// belongs to the same foliage language as the tree above it.
function buildUnderstory(rand, leafGeometry) {
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.92, metalness: 0.0, side: THREE.DoubleSide,
  })
  const understory = new THREE.InstancedMesh(leafGeometry, material, UNDERSTORY_COUNT)
  understory.name = 'understory'

  const matrix = new THREE.Matrix4()
  const scale = new THREE.Vector3()
  const tint = new THREE.Color()
  for (let i = 0; i < UNDERSTORY_COUNT; i++) {
    const azimuth = rand() * TAU
    // Push clumps clear of the camera's whole orbit, not just of the trunk, so
    // none of them swings into the lens as the camera comes around.
    let radius = 2.6 + rand() * 34
    if (radius > CAMERA_RADIUS - 2.4 && radius < CAMERA_RADIUS + 3.4) radius += 5.8
    const x = Math.cos(azimuth) * radius
    const z = Math.sin(azimuth) * radius
    const spread = 0.3 + rand() * 0.36
    matrix.makeRotationY(rand() * TAU)
    matrix.setPosition(x, groundHeight(x, z) + 0.05, z)
    matrix.scale(scale.set(spread, 0.3 + rand() * 0.5, spread))
    understory.setMatrixAt(i, matrix)
    tint.setHSL(0.25 + rand() * 0.07, 0.38 + rand() * 0.2, 0.04 + rand() * 0.07)
    understory.setColorAt(i, tint)
  }
  return understory
}

function buildDistantTrunks(rand, woodGeometry) {
  const material = new THREE.MeshStandardMaterial({
    color: 0x3b3128, roughness: 0.96, metalness: 0.0,
  })
  const trunks = new THREE.InstancedMesh(woodGeometry, material, DISTANT_TRUNK_COUNT)
  trunks.name = 'distant-trunks'

  const matrix = new THREE.Matrix4()
  for (let i = 0; i < DISTANT_TRUNK_COUNT; i++) {
    const azimuth = (i / DISTANT_TRUNK_COUNT) * TAU + rand() * 0.25
    const radius = 15 + rand() * 32
    const x = Math.cos(azimuth) * radius
    const z = Math.sin(azimuth) * radius
    const height = 9 + rand() * 11
    const width = 0.3 + rand() * 0.45
    matrix.makeRotationZ((rand() - 0.5) * 0.06)
    matrix.setPosition(x, groundHeight(x, z) - 0.2, z)
    matrix.scale(new THREE.Vector3(width, height, width))
    trunks.setMatrixAt(i, matrix)
  }
  return trunks
}

// Sun breaking through the canopy: a translucent additive cone plus the pool of
// light it lands in. Cheaper and steadier than shadow-mapped dappling.
function buildDappledLight(rand, shaftTexture, glowTexture) {
  // Narrow where it slips through the canopy gap, widening toward the floor.
  const shaftGeometry = new THREE.CylinderGeometry(1.6, 0.5, 1, 14, 1, true)
  shaftGeometry.translate(0, 0.5, 0)
  const poolGeometry = new THREE.CircleGeometry(1, 28)

  const shafts = []
  const pools = []

  for (let i = 0; i < SHAFT_COUNT; i++) {
    const azimuth = (i / SHAFT_COUNT) * TAU + rand() * 0.7
    const radius = 2.6 + rand() * 6
    const x = Math.cos(azimuth) * radius
    const z = Math.sin(azimuth) * radius
    const top = 8.5 + rand() * 2.5
    const poolRadius = 1.1 + rand() * 1.1

    const shaft = new THREE.Mesh(shaftGeometry, new THREE.MeshBasicMaterial({
      color: 0xfff0c4, map: shaftTexture, transparent: true, opacity: 0.055,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }))
    shaft.name = `light-shaft-${i}`
    shaft.position.set(x, top, z)
    shaft.scale.set(poolRadius, -top, poolRadius)   // negative Y aims it down
    shaft.userData = { baseOpacity: 0.055, flicker: 0.16 + i * 0.05, phase: rand() * TAU }
    shafts.push(shaft)

    const pool = new THREE.Mesh(poolGeometry, new THREE.MeshBasicMaterial({
      color: 0xffe9b0, map: glowTexture, transparent: true, opacity: 0.62,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }))
    pool.name = `light-pool-${i}`
    pool.rotation.x = -Math.PI / 2
    pool.position.set(x, groundHeight(x, z) + 0.03, z)
    pool.scale.setScalar(poolRadius * 1.9)
    pool.userData = { baseOpacity: 0.62, flicker: 0.19 + i * 0.06, phase: rand() * TAU }
    pools.push(pool)
  }

  return { shafts, pools }
}

function stageCamera(ctx, elapsed) {
  const angle = elapsed * 0.05
  const radius = CAMERA_RADIUS + Math.sin(elapsed * 0.07) * 0.6
  ctx.camera.position.set(
    Math.sin(angle) * radius,
    CAMERA_HEIGHT + Math.sin(elapsed * 0.11) * 0.14,
    Math.cos(angle) * radius,
  )
  ctx.camera.lookAt(0, CAMERA_TARGET_Y + Math.sin(elapsed * 0.045) * 0.35, 0)
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export function setup(ctx) {
  ctx.setHelp('Old Growth — the camera drifts on its own beneath the canopy')

  _objects = []
  _limbs = []
  _pools = []
  _shafts = []

  _prevFog = ctx.scene.fog
  _prevBackground = ctx.scene.background
  ctx.scene.fog = new THREE.FogExp2(FOG_COLOR, FOG_DENSITY)
  ctx.scene.background = new THREE.Color(FOG_COLOR)
  if (ctx.setBloom) ctx.setBloom(0.25)

  if (ctx.controls) {
    _prevControlsEnabled = ctx.controls.enabled
    ctx.controls.enabled = false
  }

  const rand = makeRandom(SEED)
  const woodGeometry = makeWoodGeometry()
  const rootGeometry = makeRootGeometry()
  const leafGeometry = new THREE.SphereGeometry(1, 5, 3)

  // Canopy light: cool sky bounce, one warm break in the leaves overhead, and a
  // dim fill so the near floor and root flare never go to black.
  track(ctx, new THREE.HemisphereLight(0x9dc2dd, 0x14110a, 0.85))

  const sun = new THREE.DirectionalLight(0xffeec2, 2.6)
  sun.position.set(7, 19, 5)
  track(ctx, sun)

  const understoryFill = new THREE.PointLight(0xffcf92, 9, 16, 2)
  understoryFill.position.set(2.5, 1.6, 3.2)
  track(ctx, understoryFill)

  const litterTexture = makeLitterTexture()
  const shaftTexture = makeShaftTexture()
  const glowTexture = makeGlowTexture()

  track(ctx, buildFloor(litterTexture))
  track(ctx, buildDistantTrunks(rand, woodGeometry))
  track(ctx, buildUnderstory(rand, leafGeometry))

  const tree = buildTree(rand, woodGeometry, rootGeometry, leafGeometry)
  track(ctx, tree.grove)

  const dappled = buildDappledLight(rand, shaftTexture, glowTexture)
  _shafts = dappled.shafts
  _pools = dappled.pools
  for (const shaft of _shafts) track(ctx, shaft)
  for (const pool of _pools) track(ctx, pool)

  stageCamera(ctx, 0)
  _active = true

  ctx._oldGrowth = {
    grove: tree.grove,
    roots: tree.roots,
    limbs: _limbs,
    canopy: _limbs.map(limb => limb.canopy),
    shafts: _shafts,
    pools: _pools,
    stats: tree.stats,
  }
}

export function update(ctx, dt) {   // eslint-disable-line no-unused-vars
  if (!_active) return
  const elapsed = ctx.elapsed

  _trunkWind.rotation.z = Math.sin(elapsed * 0.21) * TRUNK_SWAY
  _trunkWind.rotation.x = Math.sin(elapsed * 0.17 + 1.3) * TRUNK_SWAY * 0.6

  for (const limb of _limbs) {
    const sway = Math.sin(elapsed * limb.windFreq + limb.windPhase)
    limb.wind.rotation.z = sway * limb.windAmp
    limb.wind.rotation.x = Math.sin(elapsed * limb.windFreq * 0.62 + limb.windPhase * 1.7)
      * limb.windAmp * 0.55
  }

  // Dappled light breathes as the canopy stirs above it.
  for (const emitter of [..._shafts, ..._pools]) {
    const { baseOpacity, flicker, phase } = emitter.userData
    const pulse = Math.sin(elapsed * flicker + phase)
    emitter.material.opacity = baseOpacity * (0.6 + 0.4 * pulse * pulse)
  }

  stageCamera(ctx, elapsed)
}

export function teardown(ctx) {
  if (!_active) return

  const disposed = new Set()
  const dispose = (resource) => {
    if (resource && !disposed.has(resource) && typeof resource.dispose === 'function') {
      disposed.add(resource)
      resource.dispose()
    }
  }

  for (const object of _objects) {
    object.traverse((node) => {
      dispose(node.geometry)
      for (const material of [].concat(node.material ?? [])) {
        dispose(material.map)
        dispose(material.alphaMap)
        dispose(material)
      }
    })
    ctx.remove(object)
  }

  ctx.scene.fog = _prevFog
  ctx.scene.background = _prevBackground
  if (ctx.controls) ctx.controls.enabled = _prevControlsEnabled
  delete ctx._oldGrowth

  _objects = []
  _limbs = []
  _pools = []
  _shafts = []
  _trunkWind = null
  _prevFog = null
  _prevBackground = null
  _active = false
}
