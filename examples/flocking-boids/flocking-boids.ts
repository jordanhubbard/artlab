// @ts-check
// Murmuration — simultaneous Reynolds steering, spatial bins, instanced wings.
import * as Three from 'three'
import { stage, instances, seededRandom, fixedStep, SpatialHash, controlPanel, skyDome } from '../../src/stdlib/sketch.ts'

const COUNT = 900
const RADIUS = 3.2
/** @typedef {{ position: Three.Vector3, velocity: Three.Vector3, next: Three.Vector3, phase: number }} Bird */
/** @typedef {{ birds: Bird[], wings: Three.InstancedMesh, tick: (dt: number) => void, time: number, cohesion: number }} State */

/** @param {import('../../src/runtime/contracts').SketchContext<State>} ctx */
export function setup(ctx) {
  ctx.setHelp('Murmuration · 900 birds / 1,800 instanced wings · tune cohesion · drag to orbit')
  stage(ctx, [23, 12, 30], 0.25)
  skyDome(ctx)
  ctx.scene.fog = new Three.FogExp2(0x050914, 0.018)
  // A folded triangular wing, rather than a cone representing an entire bird.
  const geometry = new Three.BufferGeometry()
  geometry.setAttribute('position', new Three.Float32BufferAttribute([0, 0, 0.24, 0.75, 0.03, -0.12, 0, 0, -0.28], 3))
  geometry.computeVertexNormals()
  const wings = instances(ctx, geometry, new Three.MeshStandardMaterial({ color: 0xffffff,
    metalness: 0.45, roughness: 0.45, side: Three.DoubleSide }), COUNT * 2)
  const random = seededRandom(1807)
  const birds = Array.from({ length: COUNT }, () => ({
    position: new Three.Vector3((random() - 0.5) * 26, (random() - 0.5) * 9, (random() - 0.5) * 18),
    velocity: new Three.Vector3(2 + random() * 2, (random() - 0.5), (random() - 0.5) * 2),
    next: new Three.Vector3(), phase: random() * Math.PI * 2,
  }))
  /** @type {SpatialHash<Bird>} */
  const grid = new SpatialHash(RADIUS)
  const separation = new Three.Vector3(), alignment = new Three.Vector3(), center = new Three.Vector3()
  const delta = new Three.Vector3(), acceleration = new Three.Vector3()
  const s = ctx.state = { birds, wings, time: 0, cohesion: 0.65, tick: /** @param {number} _dt */ (_dt) => {} }
  s.tick = fixedStep(dt => {
    s.time += dt
    grid.rebuild(birds)
    // Read only the old state, then commit all velocities together (order independent).
    for (const bird of birds) {
      separation.set(0, 0, 0); alignment.set(0, 0, 0); center.set(0, 0, 0)
      let neighbors = 0
      grid.query(bird.position, RADIUS, other => {
        if (bird === other) return
        delta.subVectors(bird.position, other.position)
        const d2 = delta.lengthSq()
        if (d2 > RADIUS * RADIUS || d2 < 1e-8) return
        if (d2 < 1.4) separation.addScaledVector(delta, 1 / d2)
        alignment.add(other.velocity); center.add(other.position); neighbors++
      })
      acceleration.copy(separation).multiplyScalar(2.2)
      if (neighbors) {
        alignment.divideScalar(neighbors).sub(bird.velocity)
        center.divideScalar(neighbors).sub(bird.position)
        acceleration.addScaledVector(alignment, 0.85).addScaledVector(center, s.cohesion)
      }
      // Soft ellipsoidal containment turns the flock, avoiding teleporting seams.
      acceleration.x -= bird.position.x * 0.025
      acceleration.y -= bird.position.y * 0.15
      acceleration.z -= bird.position.z * 0.035
      acceleration.z += Math.sin(s.time * 0.22) * 0.25
      bird.next.copy(bird.velocity).addScaledVector(acceleration, dt).clampLength(2.5, 6)
    }
    for (const bird of birds) {
      bird.velocity.copy(bird.next)
      bird.position.addScaledVector(bird.velocity, dt)
    }
  }, 30)
  const tint = new Three.Color()
  for (let i = 0; i < COUNT; i++) {
    tint.setHSL(0.075 + random() * 0.07, 0.45, 0.5 + random() * 0.3)
    wings.setColorAt(i * 2, tint); wings.setColorAt(i * 2 + 1, tint)
  }
  controlPanel(ctx, 'MURMURATION / REYNOLDS RULES', {
    Cohesion: { min: 0, max: 2, step: 0.05, value: s.cohesion, change: value => { s.cohesion = value } },
  })
  update(ctx, 0)
}

const centroid = new Three.Vector3()
const dummy = new Three.Object3D(), forward = new Three.Vector3(0, 0, 1), direction = new Three.Vector3()
const orientation = new Three.Quaternion(), flap = new Three.Quaternion(), axis = new Three.Vector3(0, 0, 1)
/** @param {import('../../src/runtime/contracts').SketchContext<State>} ctx @param {number} dt */
export function update(ctx, dt) {
  const s = ctx.state
  s.tick(dt)
  for (let i = 0; i < s.birds.length; i++) {
    const bird = s.birds[i]
    orientation.setFromUnitVectors(forward, direction.copy(bird.velocity).normalize())
    for (let wing = 0; wing < 2; wing++) {
      const side = wing === 0 ? 1 : -1
      flap.setFromAxisAngle(axis, (wing === 0 ? 0 : Math.PI) + side * (0.25 + Math.sin(s.time * 9 + bird.phase) * 0.6))
      dummy.position.copy(bird.position)
      dummy.quaternion.copy(orientation).multiply(flap)
      dummy.scale.setScalar(1)
      dummy.updateMatrix()
      s.wings.setMatrixAt(i * 2 + wing, dummy.matrix)
    }
  }
  s.wings.instanceMatrix.needsUpdate = true
  centroid.set(0, 0, 0)
  for (const bird of s.birds) centroid.add(bird.position)
  centroid.divideScalar(s.birds.length).sub(ctx.controls.target).multiplyScalar(1 - Math.exp(-Math.min(dt, 0.1) * 2))
  ctx.camera.position.add(centroid)
  ctx.controls.target.add(centroid)
}
/** @param {import('../../src/runtime/contracts').SketchContext<State>} ctx */
export function teardown(ctx) { return ctx.scope.dispose() }
