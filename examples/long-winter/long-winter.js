import * as Three from 'three'
import { Scene, defineScene } from '../../src/stdlib/scene.js'
import { Character } from './Character.js'
import { PerformanceOverlay } from './PerformanceOverlay.js'
import { ACTS, BEATS_PER_BAR, SECONDS_PER_BEAT } from './score.js'
import { TrackerTransport } from './TrackerTransport.js'
import { WinterWorld } from './WinterWorld.js'

class LongWinter extends Scene {
  setup() {
    this.ctx.setHelp('Watch V2 · Space: pause/resume · ←/→: previous/next act · Explore nine songs · Open this act')
    this.ctx.setBloom(0.34)
    this.camera([0, 0.3, 10], [0, -0.2, 0])
    if (this.ctx.controls) this.scope.set(this.ctx.controls, 'enabled', false)
    this.add(new Three.HemisphereLight(0x81b5d0, 0x040913, 0.82))
    const lamp = new Three.PointLight(0xff9a38, 5.5, 18, 2)
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
    this.character.object.visible = ['blue-hour', 'hearth-song', 'birch-run', 'loose-pixel', 'first-light'].includes(position.act.id)
    this.character.update(dt, position.seconds, position.act.action, position.absoluteBeat)
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
    const p = position.actProgress
    if (position.act.id === 'blue-hour' || position.act.id === 'hearth-song' || position.act.id === 'first-light') {
      this.ctx.camera.position.set(Math.sin(t * 0.12) * 1.1, 0.15, 10)
      this.ctx.camera.lookAt(0, -0.4, -3)
    } else if (position.act.id === 'fjord-mirror') {
      this.ctx.camera.position.set(-7 + p * 14, 0.8 + Math.sin(t * 0.2), 9)
      this.ctx.camera.lookAt(0, -0.8, -7)
    } else if (position.act.id === 'aurora-code') {
      this.ctx.camera.position.set(Math.sin(t * 0.1) * 2, 1.4, 9)
      this.ctx.camera.lookAt(0, 1.2, -8)
    } else if (position.act.id === 'birch-run') {
      this.ctx.camera.position.set(Math.sin(t * 0.6) * 1.4, 0.25, 7.5)
      this.ctx.camera.lookAt(0, -0.4, -4)
    } else if (position.act.id === 'loose-pixel') {
      this.ctx.camera.position.set(0, 0.1, 10 - p * 8.5)
      this.ctx.camera.lookAt(0, 0, -5)
    } else {
      const radius = position.act.id === 'color-storm' ? 7 : 8.5
      this.ctx.camera.position.set(Math.sin(t * 0.18) * radius, 1.2 + Math.sin(t * 0.13) * 2, -7 + Math.cos(t * 0.18) * radius)
      this.ctx.camera.lookAt(0, 0, -7)
    }
  }
}

export const { setup, update, teardown } = defineScene(LongWinter)
