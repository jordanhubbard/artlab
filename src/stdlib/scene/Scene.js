import { ResourceScope } from './ResourceScope.js'

/** Compose independently owned, updatable components into an Artlab scene. */
export class Scene {
  constructor(ctx) {
    this.ctx = ctx
    this.scope = new ResourceScope()
    this.components = []
  }

  add(object) { return this.scope.add(this.ctx, object) }

  use(component) {
    this.scope.own(component)
    if (component.object) {
      this.ctx.add(component.object)
      this.scope.defer(() => this.ctx.remove(component.object))
    }
    this.components.push(component)
    return component
  }

  camera(position, target = [0, 0, 0]) {
    this.ctx.camera.position.set(...position)
    this.ctx.camera.lookAt(...target)
    this.ctx.controls?.target?.set(...target)
    this.ctx.controls?.update?.()
  }

  update(dt, elapsed) {
    for (const component of this.components) component.update?.(dt, elapsed)
  }

  dispose() {
    this.components.length = 0
    return this.scope.dispose()
  }
}

/** Adapt a scene class to setup/update/teardown, with one instance per context. */
export function defineScene(SceneClass) {
  const scenes = new WeakMap()
  return {
    setup(ctx) {
      const scene = new SceneClass(ctx)
      scenes.set(ctx, scene)
      try {
        const ready = scene.setup?.()
        if (ready?.then) return ready.catch(async error => {
          await scene.dispose()
          scenes.delete(ctx)
          throw error
        })
      } catch (error) {
        scene.dispose().catch(console.error)
        scenes.delete(ctx)
        throw error
      }
    },
    update(ctx, dt) { scenes.get(ctx)?.update(dt, ctx.elapsed) },
    teardown(ctx) {
      const scene = scenes.get(ctx)
      scenes.delete(ctx)
      return scene?.dispose()
    },
  }
}
