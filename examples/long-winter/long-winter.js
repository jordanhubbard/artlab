import * as Three from 'three'
import { Scene, defineScene } from '../../src/stdlib/scene.js'
import { Character } from './Character.js'
import { PerformanceOverlay } from './PerformanceOverlay.js'
import { SECONDS_PER_BEAT } from './score.js'
import { TrackerTransport } from './TrackerTransport.js'
import { WinterWorld } from './WinterWorld.js'

class LongWinter extends Scene {
  setup() {
    this.ctx.setHelp('Watch · Space: pause/resume · ←/→: seek 8 bars · Explore the score · Open this part')
    this.ctx.setBloom(0.85)
    this.camera([0, 0.3, 10], [0, -0.2, 0])
    if (this.ctx.controls) this.scope.set(this.ctx.controls, 'enabled', false)
    this.add(new Three.HemisphereLight(0x9cc9e2, 0x07101a, 1.35))
    const lamp = new Three.PointLight(0xffb43c, 18, 22, 2)
    lamp.position.set(-1.8, -0.9, 2)
    this.add(lamp)
    this.world = this.use(new WinterWorld())
    this.character = this.use(new Character())
    this.transport = this.scope.own(new TrackerTransport())
    this.frames = []
    const parent = this.ctx.renderer.domElement.parentElement
    this.overlay = this.scope.own(new PerformanceOverlay(parent, () => this.transport.start()))
    this.scope.listen(window, 'keydown', event => this.onKey(event))
  }

  onKey(event) {
    if (event.key === ' ') {
      event.preventDefault()
      this.transport.togglePause()
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault()
      const eightBars = 8 * 4 * SECONDS_PER_BEAT
      this.transport.seek(this.transport.seconds + (event.key === 'ArrowRight' ? eightBars : -eightBars))
    }
  }

  update(dt) {
    this.transport.update(dt)
    const position = this.transport.position
    this.world.update(dt, position, this.transport.activity)
    this.character.object.visible = position.part.id === 'invitation' || position.part.id === 'break' || position.part.id === 'return'
    this.character.update(dt, position.seconds, position.part.action, position.absoluteBeat)
    this.moveCamera(position)
    this.frames.push(Math.min(100, dt * 1000))
    if (this.frames.length > 240) this.frames.shift()
    const sorted = [...this.frames].sort((a, b) => a - b)
    const p50 = sorted[Math.floor(sorted.length * 0.5)] || 0
    const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0
    if (this.frames.length === 240) this.world.swarm.setDensity(p95 > 20 ? 0.65 : p95 < 17 ? 1 : this.world.swarm.visibleCount / this.world.swarm.count)
    const canvas = this.ctx.renderer.domElement
    this.overlay.update(position, this.transport.activity, {
      p50,
      p95,
      drawCalls: this.ctx.renderer.info?.render?.calls ?? 0,
      instances: this.world.swarm.visibleCount,
      width: canvas.width,
      height: canvas.height,
      path: this.ctx.renderer.isWebGPURenderer ? 'WebGPU' : 'WebGL2',
    })
  }

  moveCamera(position) {
    const t = position.seconds
    const p = position.partProgress
    if (position.part.id === 'invitation' || position.part.id === 'return') {
      this.ctx.camera.position.set(Math.sin(t * 0.15) * 0.35, 0.2, 10)
      this.ctx.camera.lookAt(0, -0.3, 0)
    } else if (position.part.id === 'break') {
      this.ctx.camera.position.set(0, 0.1, 10 - p * 8.5)
      this.ctx.camera.lookAt(0, 0, -5)
    } else {
      const radius = position.part.id === 'climax' ? 6.5 : 8.5
      this.ctx.camera.position.set(Math.sin(t * 0.16) * radius, 1.2 + Math.sin(t * 0.11) * 2.2, -7 + Math.cos(t * 0.16) * radius)
      this.ctx.camera.lookAt(0, 0, -7)
    }
  }
}

export const { setup, update, teardown } = defineScene(LongWinter)
