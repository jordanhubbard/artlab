import * as Three from 'three'
import { SwarmField } from './SwarmField.js'

/** The stage and the procedural world hidden behind its loose pixel. */
export class WinterWorld {
  constructor() {
    this.object = new Three.Group()
    this.stage = new Three.Group()
    this.swarm = new SwarmField()
    this.portal = new Three.Group()
    this.sun = makeSun()
    this.buildStage()
    this.buildPortal()
    this.object.add(this.stage, this.portal, this.sun, this.swarm.object)
  }

  buildStage() {
    const floor = mesh(new Three.BoxGeometry(8.5, 0.25, 4.2), 0x15283b)
    floor.position.set(0, -2.45, 0)
    const back = mesh(new Three.BoxGeometry(8.5, 4.8, 0.18), 0x284b68)
    back.position.set(0, -0.1, -1.8)
    this.loosePixel = mesh(new Three.BoxGeometry(0.48, 0.48, 0.24), 0xf1f4ed, true)
    this.loosePixel.position.set(2.25, -0.3, -1.62)
    this.stage.add(floor, back, this.loosePixel)
    for (let i = 0; i < 7; i++) {
      const band = mesh(new Three.BoxGeometry(8.2, 0.16, 0.12), i % 3 === 0 ? 0xffb43c : 0xdce9ee, true)
      band.position.set(0, -1.75 + i * 0.58, -1.67)
      this.stage.add(band)
    }
  }

  buildPortal() {
    for (let i = 0; i < 12; i++) {
      const ring = new Three.Mesh(
        new Three.TorusGeometry(2.1 + i * 0.18, 0.025, 5, 48),
        new Three.MeshBasicMaterial({ color: i % 3 ? 0x6b9aba : 0xffb43c, transparent: true, opacity: 0.25 }),
      )
      ring.position.z = -2.5 - i * 1.1
      this.portal.add(ring)
    }
    this.portal.visible = false
  }

  update(_dt, position, activity) {
    const { part, partProgress, seconds } = position
    const opening = part.id === 'invitation' || part.id === 'return'
    this.stage.visible = opening || part.id === 'break'
    this.portal.visible = !opening
    this.sun.visible = part.id === 'reveal' || part.id === 'climax'
    this.swarm.updateScore(position, activity)
    if (part.id === 'break') {
      const pull = ease(partProgress)
      this.loosePixel.position.x = 2.25 + pull * 4
      this.loosePixel.rotation.z = pull * 4
      this.stage.scale.x = 1 + pull * 2.5
    } else {
      this.loosePixel.position.x = 2.25
      this.stage.scale.x = 1
    }
    this.portal.rotation.z = seconds * 0.045
    this.sun.scale.setScalar(1 + activity.bass * 0.12)
    this.sun.material.emissiveIntensity = 1.8 + activity.melody * 2
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
    color,
    emissive: emissive ? color : 0x000000,
    emissiveIntensity: emissive ? 0.55 : 0,
    roughness: 0.78,
  }))
}

function makeSun() {
  const sun = mesh(new Three.IcosahedronGeometry(2.1, 2), 0xffb43c, true)
  sun.position.set(0, 0, -7)
  sun.visible = false
  return sun
}

function ease(value) {
  const t = Math.max(0, Math.min(1, value))
  return t * t * (3 - 2 * t)
}
