import type { Sketch, SketchContext } from '../src/runtime/contracts'
import { body, applyForce, integrate, resolveCollision, springForce } from '../src/physics/Physics.ts'
import { Vector3 } from 'three'
import { ParticleWorld } from '../src/physics/ParticleWorld.ts'
import { OrbitalWorld } from '../src/physics/OrbitalWorld.ts'
import { FluidWorld } from '../src/physics/FluidWorld.ts'
import { PhysicsComposer } from '../src/physics/PhysicsComposer.ts'
import { hud, label, progressBar, tooltip } from '../src/stdlib/ui.ts'
import type { AudioEventSink } from '../src/audio/FFTPipeline.ts'
import { emitter, forceField } from '../src/stdlib/physics/particles.ts'

type State = { speed: number }
const sketch: Sketch<State> = {
  setup(ctx) { ctx.state = { speed: 1 } },
  update(ctx, dt) { ctx.state.speed += dt },
}
void sketch

declare const ctx: SketchContext<State>
ctx.ambient('#112233')
ctx.mesh(ctx.box(), { color: '#ff8844', side: 'double' })
ctx.scope.own({ dispose() {} })
// @ts-expect-error State must keep its declared shape.
ctx.state.speed = 'fast'
// @ts-expect-error Context math must accept numeric inputs.
ctx.lerp('left', 'right', 0.5)
// @ts-expect-error Invalid material property must be caught at authoring time.
ctx.mesh(ctx.box(), { roughnes: 0.2 })
// @ts-expect-error Resource ownership requires a disposable object.
ctx.scope.own({ stop() {} })

// @ts-expect-error ctx.add overrides the multi-argument geometry.add helper.
ctx.add(ctx.scene, ctx.box())

ctx.scope.set(ctx.camera, 'near', 0.1)
// @ts-expect-error Property restoration must preserve the property's value type.
ctx.scope.set(ctx.camera, 'near', 'close')
// @ts-expect-error Scope attachment requires a scene object.
ctx.scope.add(ctx, { dispose() {} })
// @ts-expect-error Geometry helpers retain their actual implementation arity.
ctx.sphere(1, 32, 32)

const simulated = body({ mass: 2, position: new Vector3() })
applyForce(simulated, new Vector3(0, -1, 0))
integrate(simulated, 1 / 60)
resolveCollision(simulated, body())
springForce(simulated.position, new Vector3(), 1, 2)
// @ts-expect-error Body mass is numeric.
body({ mass: 'heavy' })
// @ts-expect-error Integration requires a force accumulator.
integrate({ position: new Vector3(), velocity: new Vector3(), mass: 1 }, 0.1)
// @ts-expect-error Forces must carry the Vector3 operations used by the solver.
applyForce(simulated, { x: 0, y: -1, z: 0 })

const emitters = new ParticleWorld()
emitters.addBody('sparks', { type: 'particle', rate: 30, lifetime: 2 })
const orbits = new OrbitalWorld()
orbits.addBody('planet', { type: 'orbital', semiMajorAxis: 1, eccentricity: 0, inclination: 0, period: 1 })
new PhysicsComposer().add(emitters).add(orbits).add(new FluidWorld({ viscosity: 0.2 }))
// @ts-expect-error Orbital worlds require orbital descriptors.
orbits.addBody('wrong', { type: 'particle' })
// @ts-expect-error Particle rates must be numeric.
emitters.addBody('wrong', { type: 'particle', rate: 'fast' })
// @ts-expect-error Fluid gravity requires a complete vector.
new FluidWorld({ gravity: { y: -9.8 } })

hud({ position: 'top-right' }).setText('Rendering')
label(ctx.scene, 'Origin', { offsetY: 1 }).setOpacity(0.5)
progressBar({ width: 200 }).setValue(0.5)
tooltip().show('Hover', 10, 20)
// @ts-expect-error Overlay position must be a supported anchor.
hud({ position: 'middle-left' })
// @ts-expect-error Progress is numeric.
progressBar().setValue('half')
// @ts-expect-error Attached labels require a scene object.
label(document.body, 'Invalid')

declare const audioEvents: AudioEventSink
audioEvents.emit('audio:beat', { band: 'bass', strength: 0.8 })
audioEvents.emit('audio:fft', { bass: 0.2, mid: 0.3, high: 0.1, data: new Float32Array(512) })
// @ts-expect-error Beat events use one of the detector's supported bands.
audioEvents.emit('audio:beat', { band: 'treble', strength: 0.8 })
// @ts-expect-error FFT data is a floating point decibel buffer.
audioEvents.emit('audio:fft', { bass: 0.2, mid: 0.3, high: 0.1, data: [1, 2] })

const particleHandle = emitter(emitters, ctx.scene, { color: '#ff8800', maxParticles: 100 })
particleHandle.update(1, 1 / 60)
forceField(emitters, particleHandle.emitterId, { x: 0, y: 0, z: 0 }, 2, { x: 1, y: 0, z: 0 })
// @ts-expect-error Force fields require all three force components.
forceField(emitters, particleHandle.emitterId, new Vector3(), 2, { x: 1 })
// @ts-expect-error Emitters require numeric lifetimes.
emitter(emitters, ctx.scene, { lifetime: 'forever' })
