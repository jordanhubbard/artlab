// @ts-check
// Tidal Loom — one instanced draw, 4,096 brass fins, analytic wave normals.
import * as Three from 'three'
import { stage, instances, pointer, controlPanel } from '../../src/stdlib/sketch.js'

const N = 64
const SPACING = 0.23

/** @param {number} x @param {number} z @param {number} time @param {number} frequency */
export function waveHeight(x, z, time, frequency) {
  return Math.sin(x * frequency + time) * Math.cos(z * frequency * 0.7 - time * 0.6) * 0.9
    + Math.sin(Math.hypot(x, z) * 1.6 - time * 1.7) * 0.35
}

/** @typedef {{ tiles: Three.InstancedMesh, dummy: Three.Object3D, tint: Three.Color, frequency: number, speed: number, time: number, ripple: Three.Vector2, struckAt: number }} State */
/** @param {import('../../src/runtime/contracts').SketchContext<State>} ctx */
export function setup(ctx) {
  ctx.setHelp('Tidal Loom · 4,096 instanced fins · click to send a ripple · drag to orbit')
  stage(ctx, [12, 11, 15], 0.32)
  const tiles = instances(ctx, new Three.BoxGeometry(0.20, 0.08, 0.20),
    new Three.MeshStandardMaterial({ color: 0xffffff, metalness: 0.65, roughness: 0.32 }), N * N)
  const plinth = ctx.add(new Three.Mesh(new Three.BoxGeometry(15.3, 0.7, 15.3),
    new Three.MeshStandardMaterial({ color: 0x101a2b, metalness: 0.5, roughness: 0.5 })))
  plinth.position.y = -1.9
  ctx.state = { tiles, dummy: new Three.Object3D(), tint: new Three.Color(), frequency: 0.65,
    speed: 1, time: 0, ripple: new Three.Vector2(0, 0), struckAt: -100 }
  const ray = new Three.Raycaster()
  const plane = new Three.Plane(new Three.Vector3(0, 1, 0), 0)
  const hit = new Three.Vector3()
  pointer(ctx, point => {
    ray.setFromCamera(point, ctx.camera)
    if (ray.ray.intersectPlane(plane, hit)) {
      ctx.state.ripple.set(hit.x, hit.z)
      ctx.state.struckAt = ctx.state.time
    }
  })
  controlPanel(ctx, 'TIDAL LOOM / INSTANCING', {
    Frequency: { min: 0.2, max: 1.6, step: 0.05, value: 0.65, change: value => { ctx.state.frequency = value } },
    Speed: { min: 0, max: 2, step: 0.1, value: 1, change: value => { ctx.state.speed = value } },
  })
  update(ctx, 0)
}

/** @param {import('../../src/runtime/contracts').SketchContext<State>} ctx @param {number} dt */
export function update(ctx, dt) {
  const s = ctx.state
  s.time += Math.min(dt, 0.05) * s.speed
  const age = s.time - s.struckAt
  for (let i = 0; i < N * N; i++) {
    const x = (i % N - (N - 1) / 2) * SPACING
    const z = (Math.floor(i / N) - (N - 1) / 2) * SPACING
    const distance = Math.hypot(x - s.ripple.x, z - s.ripple.y)
    const pulse = Math.sin(distance * 4 - age * 7) * Math.exp(-Math.pow(distance - age * 3, 2) * 0.8) * Math.exp(-age * 0.35)
    const height = waveHeight(x, z, s.time, s.frequency) + pulse * 0.6
    const dx = (waveHeight(x + 0.02, z, s.time, s.frequency) - waveHeight(x - 0.02, z, s.time, s.frequency)) / 0.04
    const dz = (waveHeight(x, z + 0.02, s.time, s.frequency) - waveHeight(x, z - 0.02, s.time, s.frequency)) / 0.04
    s.dummy.position.set(x, height, z)
    s.dummy.rotation.set(Math.atan(dz), 0, -Math.atan(dx))
    s.dummy.scale.set(1, 1 + (height + 1.8) * 3, 1)
    s.dummy.updateMatrix()
    s.tiles.setMatrixAt(i, s.dummy.matrix)
    s.tint.setHSL(0.53 - (height + 1.5) * 0.145, 0.65, 0.45 + height * 0.08)
    s.tiles.setColorAt(i, s.tint)
  }
  s.tiles.instanceMatrix.needsUpdate = true
  if (s.tiles.instanceColor) s.tiles.instanceColor.needsUpdate = true
}

/** @param {import('../../src/runtime/contracts').SketchContext<State>} ctx */
export function teardown(ctx) { return ctx.scope.dispose() }
