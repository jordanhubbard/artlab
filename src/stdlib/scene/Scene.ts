import { ResourceScope } from './ResourceScope.ts'
import type { Object3D } from 'three'
import type { ArtlabContext } from '../../runtime/contracts'

export interface SceneComponent {
  readonly object?: Object3D
  update?(dt: number, elapsed: number): void
  dispose(): unknown
}

/** Compose independently owned, updatable components into an Artlab scene. */
export class Scene {
  readonly ctx: ArtlabContext
  readonly scope: ResourceScope
  readonly components: SceneComponent[]
  constructor(ctx: ArtlabContext) {
    this.ctx = ctx
    this.scope = new ResourceScope()
    this.components = []
  }

  add<T extends Object3D>(object: T): T { return this.scope.add(this.ctx, object) }

  use<T extends SceneComponent>(component: T): T {
    this.scope.own(component)
    if (component.object) {
      const object = component.object
      this.ctx.add(object)
      this.scope.defer(() => this.ctx.remove(object))
    }
    this.components.push(component)
    return component
  }

  camera(position: [number, number, number], target: [number, number, number] = [0, 0, 0]) {
    this.ctx.camera.position.set(...position)
    this.ctx.camera.lookAt(...target)
    this.ctx.controls?.target?.set(...target)
    this.ctx.controls?.update?.()
  }

  update(dt: number, elapsed: number) {
    for (const component of this.components) component.update?.(dt, elapsed)
  }

  dispose() {
    this.components.length = 0
    return this.scope.dispose()
  }
}

/** Adapt a scene class to setup/update/teardown, with one instance per context. */
export function defineScene<S extends Scene & { setup?(): void | Promise<void> }>(SceneClass: new (ctx: ArtlabContext) => S) {
  const scenes = new WeakMap<ArtlabContext, S>()
  return {
    setup(ctx: ArtlabContext) {
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
    update(ctx: ArtlabContext, dt: number) { scenes.get(ctx)?.update(dt, ctx.elapsed) },
    teardown(ctx: ArtlabContext) {
      const scene = scenes.get(ctx)
      scenes.delete(ctx)
      return scene?.dispose()
    },
  }
}
