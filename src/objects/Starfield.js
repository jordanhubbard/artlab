import * as THREE from 'three'
import { STAR_COUNT, STAR_RADIUS } from '../utils/constants.js'
import starfieldVert from '../shaders/starfield.vert.glsl?raw'
import starfieldFrag from '../shaders/starfield.frag.glsl?raw'

export class Starfield {
  constructor() {
    const positions = new Float32Array(STAR_COUNT * 3)
    const colors    = new Float32Array(STAR_COUNT * 3)
    const sizes     = new Float32Array(STAR_COUNT)
    const seeds     = new Float32Array(STAR_COUNT)

    for (let i = 0; i < STAR_COUNT; i++) {
      // Uniform spherical distribution
      const u     = Math.random()
      const v     = Math.random()
      const theta = 2 * Math.PI * u
      const phi   = Math.acos(2 * v - 1)
      const r     = STAR_RADIUS * (0.85 + Math.random() * 0.15)

      positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = r * Math.cos(phi)

      // Spectral class color distribution
      const spec = Math.random()
      if (spec < 0.003) {
        // O/B blue giants — rare, very bright
        colors[i*3]=0.6; colors[i*3+1]=0.7; colors[i*3+2]=1.0
        sizes[i] = 2.5 + Math.random() * 2.0
      } else if (spec < 0.04) {
        // A white
        colors[i*3]=0.95; colors[i*3+1]=0.95; colors[i*3+2]=1.0
        sizes[i] = 1.5 + Math.random() * 1.5
      } else if (spec < 0.15) {
        // F/G yellow-white (like our Sun)
        colors[i*3]=1.0; colors[i*3+1]=1.0; colors[i*3+2]=0.85
        sizes[i] = 1.0 + Math.random() * 1.2
      } else if (spec < 0.55) {
        // K orange
        colors[i*3]=1.0; colors[i*3+1]=0.8; colors[i*3+2]=0.55
        sizes[i] = 0.8 + Math.random() * 0.8
      } else {
        // M red dwarfs — most common, dim
        colors[i*3]=1.0; colors[i*3+1]=0.45; colors[i*3+2]=0.3
        sizes[i] = 0.4 + Math.random() * 0.6
      }

      seeds[i] = Math.random()
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position',      new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('color',         new THREE.Float32BufferAttribute(colors, 3))
    geometry.setAttribute('aSize',         new THREE.Float32BufferAttribute(sizes, 1))
    geometry.setAttribute('aTwinkleSeed',  new THREE.Float32BufferAttribute(seeds, 1))

    this.uniforms = {
      uTime:         { value: 0 },
      uAudioTreble:  { value: 0 },
    }

    const material = new THREE.ShaderMaterial({
      uniforms:       this.uniforms,
      vertexShader:   starfieldVert,
      fragmentShader: starfieldFrag,
      blending:       THREE.AdditiveBlending,
      depthWrite:     false,
      vertexColors:   true,
      transparent:    true,
    })

    this.points = new THREE.Points(geometry, material)
    this.points.frustumCulled = false
  }

  update(elapsed, audioData = {}) {
    this.uniforms.uTime.value        = elapsed
    this.uniforms.uAudioTreble.value = audioData.treble ?? 0
  }
}
