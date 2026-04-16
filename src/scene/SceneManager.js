import * as THREE from 'three'

export class SceneManager {
  constructor() {
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x000005)

    // Minimal ambient — only just enough to see dark sides
    this.ambient = new THREE.AmbientLight(0x0a1020, 0.08)
    this.scene.add(this.ambient)
  }

  /** Convenience to add objects directly to the scene */
  add(...objects) {
    objects.forEach(o => this.scene.add(o))
    return this
  }
}
