import { Scene, ShaderSurface, defineScene } from '../../src/stdlib/scene.ts'
import { fragment } from './fragment.ts'

class ShaderPlayground extends Scene {
  setup() {
    this.ctx.setBloom(0.6)
    this.use(new ShaderSurface(this.ctx.renderer, fragment))
  }
}

export const { setup, update, teardown } = defineScene(ShaderPlayground)
