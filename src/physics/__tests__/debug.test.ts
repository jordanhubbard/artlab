import { expect, test } from 'vitest'
import * as Three from 'three'
import { DebugRenderer } from '../DebugRenderer.ts'
import { OrbitalWorld } from '../OrbitalWorld.ts'
import { ParticleWorld } from '../ParticleWorld.ts'
import { PhysicsComposer } from '../PhysicsComposer.ts'

test('debug geometry follows public world state and removes stale bodies', () => {
  const scene = new Three.Scene()
  const orbital = new OrbitalWorld()
  orbital.addBody('planet', { type: 'orbital', semiMajorAxis: 1, eccentricity: 0, inclination: 0, period: 1 })
  const particles = new ParticleWorld()
  particles.addBody('sparks', { type: 'particle', rate: 10, lifetime: 2 })
  const composer = new PhysicsComposer().add(orbital).add(particles)
  composer.step(0, 0.2)
  const debug = new DebugRenderer(scene)
  debug.enable()
  debug.update(composer)
  const group = scene.getObjectByName('__physics_debug__')
  expect(group?.children).toHaveLength(2)
  const mesh = group?.children.find(child => child instanceof Three.Mesh)
  expect(mesh?.position.x).toBe(orbital.getTransform('planet')?.position.x)
  const cloud = group?.children.find(child => child instanceof Three.Points)
  if (!(cloud instanceof Three.Points)) throw new Error('Missing debug particle cloud')
  expect(cloud.geometry.attributes.position.count).toBe(particles.getParticles('sparks').length)
  orbital.removeBody('planet')
  debug.update(composer)
  expect(group?.children).toHaveLength(1)
  debug.dispose()
  expect(scene.children).toHaveLength(0)
  composer.dispose()
})
