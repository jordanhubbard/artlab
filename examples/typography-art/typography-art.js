// Typography Art — "Monument".
//
// The word LANGUAGE is built as brutalist architecture: every glyph is a mass of
// extruded concrete strokes standing on its own plinth, split by a central plaza
// wide enough to walk through. A low dawn sun rakes across the letterforms so the
// word is read through its own shadows, and the camera drifts on a slow closed
// loop that sweeps wide across the front and then passes between the two halves.

import * as Three from 'three'

// ── Letterforms ───────────────────────────────────────────────────────────────
// Strokes are [x, y, width, height] rectangles on a 5x7 cell grid whose origin is
// the bottom-left of the glyph. Diagonals are stepped, not sloped, because every
// stroke is extruded from the same box: the alphabet stays buildable in stone.

const GLYPH_STROKES = {
  L: [[0, 0, 1, 7], [1, 0, 4, 1]],
  A: [[0, 0, 1, 7], [4, 0, 1, 7], [1, 6, 3, 1], [1, 3, 3, 1]],
  N: [[0, 0, 1, 7], [4, 0, 1, 7], [1, 4.5, 1, 1.5], [2, 3, 1, 1.5], [3, 1.5, 1, 1.5]],
  G: [[0, 0.8, 1, 5.4], [1, 6, 3.6, 1], [1, 0, 3.6, 1], [4, 0.8, 1, 2.4], [2.4, 2.6, 2.6, 1]],
  U: [[0, 1, 1, 6], [4, 1, 1, 6], [1, 0, 3, 1]],
  E: [[0, 0, 1, 7], [1, 6, 4, 1], [1, 3, 3, 1], [1, 0, 4, 1]],
}

const WORD = 'LANGUAGE'

const CELL          = 2.0   // world units per grid cell
const GLYPH_CELLS_W = 5
const SLAB_DEPTH    = 5.0   // extrusion depth of every stroke
const PLINTH_H      = 0.7
const PLINTH_MARGIN = 0.8   // plinth overhang on each side
const ADVANCE       = 14    // spacing between glyph centres within a half
const PLAZA_HALF    = 9     // half-width of the walkable central gap

// ── Site ──────────────────────────────────────────────────────────────────────

const GROUND_SIZE   = 900
const SKY_RADIUS    = 500
const FOG_NEAR      = 30
const FOG_FAR       = 330
const HAZE          = 0xc9a883   // dawn haze; fog and sky horizon share it

const PILLAR_ROWS   = [-60, -42, 42, 60]
const PILLAR_STEP   = 12
const PILLAR_REACH  = 66
const PILLAR_SIDE   = 3.2
const RUBBLE_COUNT  = 22

// ── Camera passage ────────────────────────────────────────────────────────────
// A closed figure-eight: it swings wide in front of the word, skims past both
// ends, and crosses the plaza at eye height. The look target rides the same loop
// with a phase lead, so the camera always faces along the row of glyphs.

const LOOP_SECONDS  = 108
const START_PHASE   = 0.78  // opening frame is a three-quarter establishing view
const PATH_RADIUS_X = 70
const PATH_RADIUS_Z = 32
const PATH_EYE_Y    = 6.6
const PATH_RISE     = 2.2
const LOOK_LEAD     = 2.4
const LOOK_RADIUS_X = 46
const LOOK_RADIUS_Z = 4
const LOOK_EYE_Y    = 6.8

/** Deterministic pseudo-random value in [0,1) — keeps the ruin reproducible. */
function hash(n) {
  const x = Math.sin(n * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

function pathPoint(phase, out) {
  return out.set(
    PATH_RADIUS_X * Math.sin(phase),
    PATH_EYE_Y + PATH_RISE * Math.sin(phase * 3 + 0.4),
    PATH_RADIUS_Z * Math.sin(phase * 2),
  )
}

function lookPoint(phase, out) {
  const p = phase + LOOK_LEAD
  return out.set(
    LOOK_RADIUS_X * Math.sin(p),
    LOOK_EYE_Y,
    LOOK_RADIUS_Z * Math.sin(p * 2),
  )
}

function placeCamera(ctx, elapsed) {
  const phase = START_PHASE + (elapsed * Math.PI * 2) / LOOP_SECONDS
  ctx.camera.position.copy(pathPoint(phase, ctx._camPos))
  ctx.camera.lookAt(lookPoint(phase, ctx._camLook))
}

// ── Construction helpers ──────────────────────────────────────────────────────

/** A single extruded stone block, sized from the shared unit box. */
function block(group, geometry, material, x, y, z, w, h, d) {
  const m = new Three.Mesh(geometry, material)
  m.scale.set(w, h, d)
  m.position.set(x, y, z)
  m.castShadow = true
  m.receiveShadow = true
  group.add(m)
  return m
}

/** One glyph: a plinth plus its extruded strokes, settled slightly with age. */
function buildGlyph(letter, index, geometry, material) {
  const glyph = new Three.Group()
  const glyphWidth = GLYPH_CELLS_W * CELL

  block(
    glyph, geometry, material,
    0, PLINTH_H / 2, 0,
    glyphWidth + PLINTH_MARGIN * 2, PLINTH_H, SLAB_DEPTH + PLINTH_MARGIN * 2,
  )

  for (const [cx, cy, cw, ch] of GLYPH_STROKES[letter]) {
    block(
      glyph, geometry, material,
      (cx + cw / 2 - GLYPH_CELLS_W / 2) * CELL,
      PLINTH_H + (cy + ch / 2) * CELL,
      0,
      cw * CELL, ch * CELL, SLAB_DEPTH,
    )
  }

  // Centuries of settling: a hair of lean and sink, never enough to float.
  glyph.rotation.z = (hash(index + 1) - 0.5) * 0.02
  glyph.rotation.y = (hash(index + 7) - 0.5) * 0.05
  glyph.position.set(glyphCenterX(index), -hash(index + 13) * 0.12, 0)
  return glyph
}

/** Glyph centres, split by the plaza: half the word on each side of the origin. */
function glyphCenterX(index) {
  const half = WORD.length / 2
  const fromPlaza = index < half ? half - 1 - index : index - half
  const offset = PLAZA_HALF + (GLYPH_CELLS_W * CELL) / 2 + fromPlaza * ADVANCE
  return index < half ? -offset : offset
}

function buildPillars(geometry, material) {
  const pillars = new Three.Group()
  let seed = 0
  for (const z of PILLAR_ROWS) {
    for (let x = -PILLAR_REACH; x <= PILLAR_REACH; x += PILLAR_STEP) {
      seed += 1
      const broken = hash(seed * 3 + 2) < 0.3
      const height = broken ? 2.5 + hash(seed * 5) * 3 : 7 + hash(seed * 5) * 13
      const jitter = (hash(seed * 11) - 0.5) * 4
      block(
        pillars, geometry, material,
        x + jitter, height / 2, z + (hash(seed * 17) - 0.5) * 6,
        PILLAR_SIDE, height, PILLAR_SIDE,
      )
    }
  }
  return pillars
}

function buildRubble(geometry, material) {
  const rubble = new Three.Group()
  for (let i = 0; i < RUBBLE_COUNT; i++) {
    const width  = 3 + hash(i * 2 + 1) * 4
    const height = 0.8 + hash(i * 2 + 5) * 0.8
    const depth  = 2 + hash(i * 2 + 9) * 2
    const slab = block(
      rubble, geometry, material,
      (hash(i * 3 + 4) - 0.5) * 132,
      height / 2,
      (hash(i * 3 + 8) - 0.5) * 44,
      width, height, depth,
    )
    slab.rotation.y = hash(i * 7 + 3) * Math.PI
    slab.rotation.z = (hash(i * 7 + 6) - 0.5) * 0.25
  }
  return rubble
}

/** Vertical dawn gradient: indigo zenith fading down to a burning horizon. */
function makeSkyTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 4
  canvas.height = 256

  const g = canvas.getContext('2d')
  if (g) {
    const gradient = g.createLinearGradient(0, 0, 0, canvas.height)
    gradient.addColorStop(0.00, '#0d1230')
    gradient.addColorStop(0.35, '#3d3358')
    gradient.addColorStop(0.62, '#94647a')
    gradient.addColorStop(0.80, '#e8a86a')
    gradient.addColorStop(0.90, '#f6d3a2')
    gradient.addColorStop(1.00, '#5a4632')
    g.fillStyle = gradient
    g.fillRect(0, 0, canvas.width, canvas.height)
  }

  return new Three.CanvasTexture(canvas)
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

export function setup(ctx) {
  ctx.setHelp('Monument — dawn drifts through a word built as architecture; no input needed')

  ctx._prevFog = ctx.scene.fog ?? null
  ctx._prevBackground = ctx.scene.background ?? null
  ctx.scene.fog = new Three.Fog(HAZE, FOG_NEAR, FOG_FAR)
  ctx.setBloom?.(0.3)
  if (ctx.controls) ctx.controls.enabled = false

  ctx._camPos = new Three.Vector3()
  ctx._camLook = new Three.Vector3()

  const strokeGeo = new Three.BoxGeometry(1, 1, 1)
  const groundGeo = new Three.PlaneGeometry(GROUND_SIZE, GROUND_SIZE)
  const skyGeo    = new Three.SphereGeometry(SKY_RADIUS, 32, 24)

  const stoneMat = new Three.MeshStandardMaterial({
    color: 0x9b9186, roughness: 0.92, metalness: 0.0,
  })
  const pillarMat = new Three.MeshStandardMaterial({
    color: 0x7d7469, roughness: 0.95, metalness: 0.0,
  })
  const groundMat = new Three.MeshStandardMaterial({
    color: 0x6d6459, roughness: 1.0, metalness: 0.0,
  })
  const skyTexture = makeSkyTexture()
  const skyMat = new Three.MeshBasicMaterial({
    map: skyTexture, side: Three.BackSide, depthWrite: false, fog: false,
  })

  ctx._geometries = [strokeGeo, groundGeo, skyGeo]
  ctx._materials  = [stoneMat, pillarMat, groundMat, skyMat]
  ctx._textures   = [skyTexture]

  ctx._sky = new Three.Mesh(skyGeo, skyMat)

  ctx._ground = new Three.Mesh(groundGeo, groundMat)
  ctx._ground.rotation.x = -Math.PI / 2
  ctx._ground.receiveShadow = true

  ctx._monument = new Three.Group()
  for (let i = 0; i < WORD.length; i++) {
    ctx._monument.add(buildGlyph(WORD[i], i, strokeGeo, stoneMat))
  }

  ctx._pillars = buildPillars(strokeGeo, pillarMat)
  ctx._rubble  = buildRubble(strokeGeo, pillarMat)

  // Low dawn sun raking along the word, plus a cool sky fill so the shadowed
  // faces still describe their edges.
  const sun = new Three.DirectionalLight(0xffd2a0, 2.8)
  sun.position.set(-130, 24, 78)
  sun.castShadow = true
  sun.shadow.mapSize.setScalar(2048)
  sun.shadow.camera.left = -120
  sun.shadow.camera.right = 120
  sun.shadow.camera.top = 120
  sun.shadow.camera.bottom = -120
  sun.shadow.camera.near = 1
  sun.shadow.camera.far = 500
  sun.shadow.bias = -0.0008
  ctx._sun = sun

  const fill = new Three.DirectionalLight(0x5b7fb8, 0.45)
  fill.position.set(110, 20, -90)

  const skyLight = new Three.HemisphereLight(0x8fa8d8, 0x6b5a44, 0.6)

  ctx._roots = [ctx._sky, ctx._ground, ctx._monument, ctx._pillars, ctx._rubble, sun, fill, skyLight]
  for (const root of ctx._roots) ctx.add(root)

  placeCamera(ctx, 0)
}

export function update(ctx, dt) {  // eslint-disable-line no-unused-vars
  placeCamera(ctx, ctx.elapsed)
}

export function teardown(ctx) {
  for (const root of ctx._roots ?? []) ctx.remove(root)
  for (const geometry of ctx._geometries ?? []) geometry.dispose()
  for (const material of ctx._materials ?? []) material.dispose()
  for (const texture of ctx._textures ?? []) texture.dispose()
  ctx._sun?.dispose?.()

  ctx.scene.fog = ctx._prevFog ?? null
  ctx.scene.background = ctx._prevBackground ?? null
  if (ctx.controls) ctx.controls.enabled = true

  ctx._roots = null
  ctx._geometries = null
  ctx._materials = null
  ctx._textures = null
  ctx._monument = null
  ctx._pillars = null
  ctx._rubble = null
  ctx._ground = null
  ctx._sky = null
  ctx._sun = null
}
