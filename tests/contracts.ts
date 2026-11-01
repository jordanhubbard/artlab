import type { Sketch, SketchContext } from '../src/runtime/contracts'
import { body, applyForce, integrate, resolveCollision, springForce } from '../src/physics/Physics.ts'
import { Vector3 } from 'three'

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
