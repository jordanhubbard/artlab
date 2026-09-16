import { Scene, ShaderSurface, defineScene } from '../../src/stdlib/scene.js'
import { fragment } from './fragment.js'

class ShaderPlayground extends Scene {
  setup() {
    this.ctx.setBloom(0.6)
    this.use(new ShaderSurface(this.ctx.renderer, fragment))
  }
}

export const { setup, update, teardown } = defineScene(ShaderPlayground)
