// @ts-check
// Ember Engine — the former fountain and particle-storm lessons in one pool.
import * as Three from 'three'
import { body, integrate, gravityForce, dragForce, vortexField } from '../../src/physics/Physics.ts'
import { stage, instances, seededRandom, fixedStep, controlPanel, pointer } from '../../src/stdlib/sketch.ts'

const COUNT = 2400
/** @typedef {ReturnType<typeof body> & { age: number, life: number }} Particle */
/** @typedef {{ particles: Particle[], mesh: Three.InstancedMesh, tick: (dt: number) => void, mode: number, origin: Three.Vector3 }} State */

/** @param {import('../../src/runtime/contracts').SketchContext<State>} ctx */
export function setup(ctx) {
  ctx.setHelp('Ember Engine · fountain / vortex storm · click to move source · drag to orbit')
  stage(ctx, [14, 10, 20], 0.7)
  const mesh = instances(ctx, new Three.BoxGeometry(0.045, 0.16, 0.045),
    new Three.MeshBasicMaterial({ color: 0xffffff }), COUNT)
  const random = seededRandom(1984)
  const origin = new Three.Vector3(0, -3, 0)
  const axis = new Three.Vector3(0, 1, 0)
  /** @type {Particle[]} */
  const particles = Array.from({ length: COUNT }, () => ({ ...body(), age: 0, life: 1 }))
  /** @param {Particle} particle */
  function spawn(particle) {
    particle.position.copy(origin)
    const angle = random() * Math.PI * 2
    const spread = s.mode ? 2.8 : 0.9
    particle.velocity.set(Math.cos(angle) * spread * random(), 5 + random() * 6, Math.sin(angle) * spread * random())
    particle.age = 0
    particle.life = 1.5 + random() * 3
  }
  const s = ctx.state = { particles, mesh, origin, mode: 0, tick: /** @param {number} _dt */ (_dt) => {} }
  const gravity = gravityForce(1, 4)
  s.tick = fixedStep(dt => {
    for (const particle of particles) {
      particle.age += dt
      if (particle.age > particle.life || particle.position.y < -3.1) spawn(particle)
      particle.force.copy(gravity).add(dragForce(particle.velocity, 0.12))
      if (s.mode) particle.force.add(vortexField(origin, axis, particle.position, 12))
      integrate(particle, dt)
    }
  })
  // Pre-roll gives a complete composition on the first rendered frame.
  for (const particle of particles) { spawn(particle); particle.age = random() * particle.life }
  for (let i = 0; i < 120; i++) s.tick(1 / 60)
  const ground = ctx.add(new Three.Mesh(new Three.CylinderGeometry(7, 7.4, 0.4, 96),
    new Three.MeshStandardMaterial({ color: 0x121b28, metalness: 0.5, roughness: 0.35 })))
  ground.position.y = -3.4
  const ring = ctx.add(new Three.Mesh(new Three.TorusGeometry(2, 0.025, 8, 100),
    new Three.MeshBasicMaterial({ color: 0xffaa44 })))
  ring.rotation.x = Math.PI / 2; ring.position.y = -3.1
  const ray = new Three.Raycaster(), hit = new Three.Vector3()
  const plane = new Three.Plane(axis, 3)
  pointer(ctx, p => {
    ray.setFromCamera(p, ctx.camera)
    if (ray.ray.intersectPlane(plane, hit)) {
      origin.set(Three.MathUtils.clamp(hit.x, -5, 5), -3, Three.MathUtils.clamp(hit.z, -5, 5))
      ring.position.set(origin.x, -3.1, origin.z)
    }
  })
  controlPanel(ctx, 'EMBER ENGINE / FORCE INTEGRATION', {
    'Storm mode': { min: 0, max: 1, step: 1, value: 0, change: value => { s.mode = value } },
  })
  update(ctx, 0)
}
const dummy = new Three.Object3D(), tint = new Three.Color()
/** @param {import('../../src/runtime/contracts').SketchContext<State>} ctx @param {number} dt */
export function update(ctx, dt) {
  const s = ctx.state
  s.tick(dt)
  for (let i = 0; i < COUNT; i++) {
    const particle = s.particles[i]
    const fade = 1 - particle.age / particle.life
    dummy.position.copy(particle.position)
    dummy.scale.setScalar(0.4 + fade)
    dummy.updateMatrix()
    s.mesh.setMatrixAt(i, dummy.matrix)
    tint.setHSL(0.015 + fade * 0.12, 0.9, 0.16 + fade * 0.55)
    s.mesh.setColorAt(i, tint)
  }
  s.mesh.instanceMatrix.needsUpdate = true
  if (s.mesh.instanceColor) s.mesh.instanceColor.needsUpdate = true
}
/** @param {import('../../src/runtime/contracts').SketchContext<State>} ctx */
export function teardown(ctx) { return ctx.scope.dispose() }
