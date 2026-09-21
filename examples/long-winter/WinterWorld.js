import * as Three from 'three'
import { DemoGraphics } from './DemoGraphics.js'
import { NordicLandscape } from './NordicLandscape.js'
import { SwarmField } from './SwarmField.js'

/** The northern landscape and the demo world concealed inside one loose pixel. */
export class WinterWorld {
  constructor() {
    this.object = new Three.Group()
    this.stage = new Three.Group()
    this.landscape = new NordicLandscape()
    this.demo = new DemoGraphics()
    this.swarm = new SwarmField()
    this.portal = new Three.Group()
    this.sun = makeSun()
    this.buildStage()
    this.buildPortal()
    this.object.add(this.landscape.object, this.stage, this.portal, this.sun, this.demo.object, this.swarm.object)
  }

  buildStage() {
    const floor = mesh(new Three.BoxGeometry(8.5, 0.25, 4.2), 0x101d32)
    floor.position.set(0, -2.45, 0)
    const back = mesh(new Three.BoxGeometry(8.5, 4.8, 0.18), 0x1b3551)
    back.position.set(0, -0.1, -1.8)
    this.loosePixel = mesh(new Three.BoxGeometry(0.48, 0.48, 0.24), 0xff9d32, true)
    this.loosePixel.position.set(2.25, -0.3, -1.62)
    this.stage.add(floor, back, this.loosePixel)
    const colors = [0x00cde8, 0x7048da, 0xea3d94, 0xff9d32]
    for (let i = 0; i < 8; i++) {
      const band = mesh(new Three.BoxGeometry(8.2, 0.12, 0.12), colors[i % colors.length], true)
      band.position.set(0, -1.85 + i * 0.52, -1.67)
      this.stage.add(band)
    }
    this.stage.visible = false
  }

  buildPortal() {
    const colors = [0x00e5ff, 0xff3ea5, 0xff9e2c]
    for (let i = 0; i < 14; i++) {
      const ring = new Three.Mesh(
        new Three.TorusGeometry(1.8 + i * 0.2, 0.022, 5, 48),
        new Three.MeshBasicMaterial({ color: colors[i % colors.length], transparent: true, opacity: 0.38 }),
      )
      ring.position.z = -2.5 - i * 1.05
      this.portal.add(ring)
    }
    this.portal.visible = false
  }

  update(dt, position, activity) {
    const { act, actProgress, seconds } = position
    this.landscape.update(dt, position, activity)
    this.demo.update(dt, position, activity)
    this.swarm.updateScore(position, activity)
    this.stage.visible = act.id === 'loose-pixel'
    this.portal.visible = act.id === 'loose-pixel' || act.id === 'copper-tunnel'
    this.sun.visible = act.id === 'color-storm'
    if (act.id === 'loose-pixel') {
      const pull = ease(actProgress)
      this.loosePixel.position.x = 2.25 + pull * 3.8
      this.loosePixel.rotation.z = pull * 5
      this.stage.scale.x = 1 + pull * 1.8
    } else {
      this.loosePixel.position.x = 2.25
      this.stage.scale.x = 1
    }
    this.portal.rotation.z = seconds * 0.065
    this.sun.rotation.y = seconds * 0.18
    this.sun.scale.setScalar(1 + activity.bass * 0.08)
    this.sun.material.emissiveIntensity = 0.55 + activity.melody * 0.32
  }

  dispose() {
    const resources = new Set()
    this.object.traverse(object => {
      if (object.geometry) resources.add(object.geometry)
      for (const material of [object.material].flat()) if (material) resources.add(material)
    })
    for (const resource of resources) resource.dispose()
    this.object.removeFromParent()
  }
}

function mesh(geometry, color, emissive = false) {
  return new Three.Mesh(geometry, new Three.MeshStandardMaterial({
    color, emissive: emissive ? color : 0x000000, emissiveIntensity: emissive ? 0.22 : 0, roughness: 0.8,
  }))
}

function makeSun() {
  const sun = mesh(new Three.IcosahedronGeometry(2.25, 2), 0xff6f32, true)
  sun.material.wireframe = true
  sun.position.set(0, 0, -7)
  sun.visible = false
  return sun
}

function ease(value) {
  const t = Math.max(0, Math.min(1, value))
  return t * t * (3 - 2 * t)
}
