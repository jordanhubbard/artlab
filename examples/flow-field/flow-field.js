import { Scene, defineScene } from '../../src/stdlib/scene.js'
import { FlowParticles } from './FlowParticles.js'

class FlowField extends Scene {
  setup() {
    this.camera([0, 0, 60])
    this.ctx.setBloom(1)
    this.use(new FlowParticles({ count: 4000 }))
  }
}

export const { setup, update, teardown } = defineScene(FlowField)
