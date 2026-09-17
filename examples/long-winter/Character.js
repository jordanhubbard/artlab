import * as Three from 'three'

/** The maintenance robot performer and its recurring amber lamp. */
export class Character {
  constructor() {
    this.object = new Three.Group()
    this.object.name = 'Pip, winter maintenance robot'
    const paper = new Three.MeshStandardMaterial({ color: 0xe7edf2, roughness: 0.72 })
    const dark = new Three.MeshStandardMaterial({ color: 0x172333, roughness: 0.8 })
    const amber = new Three.MeshStandardMaterial({ color: 0xffb43c, emissive: 0xff8a18, emissiveIntensity: 1.8 })
    this.body = new Three.Mesh(new Three.BoxGeometry(1.15, 1.3, 0.75), paper)
    this.head = new Three.Mesh(new Three.BoxGeometry(0.9, 0.62, 0.68), paper)
    this.head.position.y = 0.96
    this.eye = new Three.Mesh(new Three.BoxGeometry(0.48, 0.12, 0.04), dark)
    this.eye.position.set(0, 1.02, 0.36)
    this.lamp = new Three.Mesh(new Three.SphereGeometry(0.18, 12, 8), amber)
    this.lamp.position.set(0.82, 0.38, 0.18)
    this.arm = new Three.Mesh(new Three.BoxGeometry(0.18, 0.9, 0.18), dark)
    this.arm.position.set(0.65, 0.1, 0)
    this.object.add(this.body, this.head, this.eye, this.lamp, this.arm)
    this.object.position.set(-2.6, -1.65, 0.4)
  }

  update(_dt, elapsed, action = 'tend', beat = 0) {
    this.object.position.y = -1.65 + Math.sin(elapsed * 3) * 0.035
    this.head.rotation.z = Math.sin(elapsed * 1.4) * 0.04
    this.arm.rotation.z = action === 'pull' ? -1.2 : action === 'conduct' ? Math.sin(beat * Math.PI) * 0.9 : -0.2
    this.object.rotation.z = action === 'bow' ? -0.18 - Math.sin(Math.min(1, beat / 4) * Math.PI) * 0.24 : 0
    const pulse = 1 + Math.max(0, Math.sin(beat * Math.PI * 2)) * 0.16
    this.lamp.scale.setScalar(pulse)
  }

  dispose() { disposeTree(this.object) }
}

function disposeTree(root) {
  root.traverse(object => {
    object.geometry?.dispose()
    for (const material of [object.material].flat()) material?.dispose()
  })
  root.removeFromParent()
}
