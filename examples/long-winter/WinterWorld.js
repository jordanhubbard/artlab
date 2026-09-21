import * as Three from 'three'
import { DemoGraphics } from './DemoGraphics.js'
import { NordicLandscape } from './NordicLandscape.js'

/** The physical fjord gives way to three ray-traced impossible sculptures. */
export class WinterWorld {
  constructor(renderer) {
    this.object = new Three.Group()
    this.landscape = new NordicLandscape()
    this.demo = new DemoGraphics(renderer)
    this.object.add(this.landscape.object, this.demo.object)
  }

  update(dt, position, activity) {
    this.landscape.update(dt, position, activity)
    this.demo.update(dt, position, activity)
  }

  dispose() {
    this.landscape.dispose()
    const resources = new Set()
    this.object.traverse(object => {
      if (object.isInstancedMesh) object.dispose()
      if (object.geometry) resources.add(object.geometry)
      for (const material of [object.material].flat()) if (material) resources.add(material)
    })
    for (const resource of resources) resource.dispose()
    this.object.removeFromParent()
  }
}
