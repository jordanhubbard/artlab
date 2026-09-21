import * as Three from 'three'
import { Scene, defineScene } from '../../src/stdlib/scene.js'
import { PerformanceOverlay } from './PerformanceOverlay.js'
import { ACTS, BEATS_PER_BAR, SECONDS_PER_BEAT } from './score.js'
import { TrackerTransport } from './TrackerTransport.js'
import { WinterWorld } from './WinterWorld.js'

class LongWinter extends Scene {
  setup() {
    this.ctx.setHelp('Watch Northern Light · Fullscreen for native-resolution visuals · Space: pause/resume · ←/→: acts')
    this.ctx.setBloom(0.22)
    this.camera([0, 1, 15], [0, 3, -30])
    this.scope.defer(() => this.ctx.camera.updateProjectionMatrix())
    this.scope.set(this.ctx.camera, 'far', 400)
    this.ctx.camera.updateProjectionMatrix()
    if (this.ctx.controls) this.scope.set(this.ctx.controls, 'enabled', false)
    this.add(new Three.HemisphereLight(0x9cbde0, 0x0d1d30, 1.5))
    this.moonlight = new Three.DirectionalLight(0xa9cfea, 2.3)
    this.moonlight.position.set(-15, 25, -10)
    this.add(this.moonlight)
    this.world = this.use(new WinterWorld(this.ctx.renderer))
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
      const position = this.transport.position
      const offset = event.key === 'ArrowRight' ? 1 : -1
      const target = ACTS[Math.max(0, Math.min(ACTS.length - 1, position.actIndex + offset))]
      this.transport.seek(target.startBar * BEATS_PER_BAR * SECONDS_PER_BEAT)
    }
  }

  update(dt) {
    this.transport.update(dt)
    const position = this.transport.position
    this.world.update(dt, position, this.transport.activity)
    this.moonlight.color.set(position.act.id === 'first-light' ? 0xffc59a : 0xa9cfea)
    this.moveCamera(position)
    this.frames.push(dt * 1000)
    if (this.frames.length > 240) this.frames.shift()
    const sorted = [...this.frames].sort((a, b) => a - b)
    const p50 = sorted[Math.floor(sorted.length * 0.5)] || 0
    const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0
    const canvas = this.ctx.renderer.domElement
    this.overlay.update(position, this.transport.activity, {
      p50,
      p95,
      drawCalls: this.ctx.renderer.info?.render?.calls ?? 0,
      width: canvas.width,
      height: canvas.height,
      path: this.world.demo.object.visible ? 'WebGL2 · ray marching + reflection bounce' : 'WebGL2 · planar reflection + procedural sky',
    })
  }

  moveCamera(position) {
    const t = position.seconds
    const p = position.actProgress
    if (position.act.id === 'blue-hour' || position.act.id === 'first-light') {
      this.ctx.camera.position.set(Math.sin(t * .08) * 3, 1 + p * 1.5, 15 - p * 4)
      this.ctx.camera.lookAt(0, 4, -35)
    } else if (position.act.id === 'hearth-song') {
      this.ctx.camera.position.set(-3 - p * 4, .4 + Math.sin(p * Math.PI), 4 - p * 3)
      this.ctx.camera.lookAt(-7, -.1, -15)
    } else if (position.act.id === 'fjord-mirror') {
      this.ctx.camera.position.set(-5 + p * 10, -1.7 + Math.sin(p * Math.PI) * .5, 10 - p * 7)
      this.ctx.camera.lookAt(0, 3, -40)
    } else if (position.act.id === 'aurora-code') {
      this.ctx.camera.position.set(Math.sin(t * .1) * 3, 2 + p * 3, 8)
      this.ctx.camera.lookAt(0, 12, -38)
    } else if (position.act.id === 'birch-run') {
      this.ctx.camera.position.set(Math.sin(p * Math.PI * 2) * 1.2, -.2 + Math.sin(t * .5) * .15, 9 - p * 22)
      this.ctx.camera.lookAt(0, 1.3, -32)
    }
  }
}

export const { setup, update, teardown } = defineScene(LongWinter)
