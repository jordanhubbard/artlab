import { Scene, defineScene } from '../../src/stdlib/scene.ts'
import { FlowParticles } from './FlowParticles.ts'

class FlowField extends Scene {
  setup() {
    this.camera([0, 0, 60])
    this.ctx.setBloom(1)
    this.use(new FlowParticles({ count: 4000 }))
  }
}

export const { setup, update, teardown } = defineScene(FlowField)
