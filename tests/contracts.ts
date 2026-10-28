import type { Sketch, SketchContext } from '../src/runtime/contracts'

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
