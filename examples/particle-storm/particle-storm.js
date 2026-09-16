import { Scene, defineScene } from '../../src/stdlib/scene.js'
import { EmberField } from './EmberField.js'

class ParticleStorm extends Scene {
  setup() {
    this.camera([0, 2, 14])
    this.ctx.setBloom(0.6)
    this.use(new EmberField({ count: 500, radius: 8 }))
  }
}

export const { setup, update, teardown } = defineScene(ParticleStorm)
