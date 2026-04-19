import * as THREE from 'three'
import { keplerPosition, degToRad } from '../utils/MathUtils.js'
import { AU_SCALE } from '../utils/constants.js'
import { PLANET_DATA, PLANET_ORDER } from '../orbital/planetData.js'

const ORBIT_SEGMENTS = 256

export class OrbitLines {
  constructor() {
    this.group = new THREE.Object3D()
    this.group.name = 'orbitLines'

    for (const name of PLANET_ORDER) {
      this.group.add(this._buildLine(PLANET_DATA[name]))
    }
  }

  _buildLine(data) {
    const inc = degToRad(data.inclination)
    const points = []

    for (let i = 0; i <= ORBIT_SEGMENTS; i++) {
      const M = (i / ORBIT_SEGMENTS) * Math.PI * 2
      const { x, z } = keplerPosition(data.semiMajorAxis, data.eccentricity, M, AU_SCALE)
      points.push(new THREE.Vector3(x, Math.sin(inc) * z, Math.cos(inc) * z))
    }

    const geo = new THREE.BufferGeometry().setFromPoints(points)
    const mat = new THREE.LineBasicMaterial({
      color: data.color,
      transparent: true,
      opacity: 0.15,
      depthWrite: false,
    })

    return new THREE.Line(geo, mat)
  }

  toggle() {
    this.group.visible = !this.group.visible
  }
}
