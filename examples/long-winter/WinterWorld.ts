import * as Three from 'three'
import { DemoGraphics } from './DemoGraphics.ts'
import { NordicLandscape } from './NordicLandscape.ts'
import type { MusicalPosition, VoiceActivity } from './score.ts'

/** The physical fjord gives way to three ray-traced impossible sculptures. */
export class WinterWorld {
  readonly object: Three.Group
  readonly landscape: NordicLandscape
  readonly demo: DemoGraphics
  constructor(renderer: ConstructorParameters<typeof DemoGraphics>[0]) {
    this.object = new Three.Group()
    this.landscape = new NordicLandscape()
    this.demo = new DemoGraphics(renderer)
    this.object.add(this.landscape.object, this.demo.object)
  }

  updateScore(dt: number, position: MusicalPosition, activity: VoiceActivity) {
    this.landscape.update(dt, position, activity)
    this.demo.update(dt, position, activity)
  }

  dispose() {
    this.landscape.dispose()
    const resources = new Set<Three.BufferGeometry | Three.Material>()
    this.object.traverse(object => {
      if (object instanceof Three.InstancedMesh) object.dispose()
      if (!(object instanceof Three.Mesh || object instanceof Three.Points || object instanceof Three.Line)) return
      resources.add(object.geometry)
      for (const material of [object.material].flat()) if (material) resources.add(material)
    })
    for (const resource of resources) resource.dispose()
    this.object.removeFromParent()
  }
}
