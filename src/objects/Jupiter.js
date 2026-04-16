import * as THREE from 'three'
import { PLANET_SCALE, LOD_HIGH, LOD_MED, LOD_LOW } from '../utils/constants.js'
import { degToRad } from '../utils/MathUtils.js'
import atmosphereVert from '../shaders/atmosphere.vert.glsl?raw'
import atmosphereFrag from '../shaders/atmosphere.frag.glsl?raw'
import cloudsVert from '../shaders/jupiter_clouds.vert.glsl?raw'
import cloudsFrag from '../shaders/jupiter_clouds.frag.glsl?raw'

export class Jupiter {
  constructor(texManager, data) {
    this.data  = data
    this.group = new THREE.Group()
    this.group.rotation.z = degToRad(data.axialTilt ?? 3.13)

    const r = data.radius * PLANET_SCALE

    this.cloudUniforms = {
      uJupiterMap:    { value: texManager.load(data.textures.map, data.color) },
      uSunDirection:  { value: new THREE.Vector3(1, 0, 0) },
      uTime:          { value: 0 },
      uAudioMid:      { value: 0 },
    }

    const mat = new THREE.ShaderMaterial({
      uniforms:       this.cloudUniforms,
      vertexShader:   cloudsVert,
      fragmentShader: cloudsFrag,
    })

    this.lod = new THREE.LOD()
    const mk = (segs) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, segs, segs / 2), mat)
      m.castShadow = m.receiveShadow = true
      return m
    }
    this.lod.addLevel(mk(128), LOD_HIGH)
    this.lod.addLevel(mk(64),  LOD_MED)
    this.lod.addLevel(mk(32),  LOD_LOW)
    this.group.add(this.lod)

    // Faint atmosphere
    const ar = r * 1.01
    this.atmoUniforms = {
      uSunPosition:        { value: new THREE.Vector3() },
      uAtmosphereColor:    { value: new THREE.Vector3(0.8, 0.6, 0.35) },
      uAtmosphereStrength: { value: 0.35 },
      uOpacity:            { value: 0.45 },
    }
    const atmoGeo = new THREE.SphereGeometry(ar, 48, 48)
    const mkAtmo = (side) => new THREE.ShaderMaterial({
      uniforms: this.atmoUniforms, vertexShader: atmosphereVert,
      fragmentShader: atmosphereFrag, blending: THREE.AdditiveBlending,
      transparent: true, depthWrite: false, side,
    })
    this.group.add(new THREE.Mesh(atmoGeo, mkAtmo(THREE.FrontSide)))
  }

  update(elapsed, sunWorldPos, audioData = {}) {
    const yearSecs = 120
    const rotN = (2 * Math.PI) / (this.data.rotationPeriod * 86400 * (yearSecs / 365.25))
    this.lod.rotation.y = rotN * elapsed

    if (sunWorldPos) {
      const sunDir = sunWorldPos.clone().sub(this.group.position).normalize()
      this.cloudUniforms.uSunDirection.value.copy(sunDir)
      this.atmoUniforms.uSunPosition.value.copy(sunWorldPos)
    }

    this.cloudUniforms.uTime.value     = elapsed
    this.cloudUniforms.uAudioMid.value = audioData.mid ?? 0
  }

  get mesh() { return this.group }
}
