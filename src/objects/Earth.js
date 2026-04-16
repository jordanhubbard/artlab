import * as THREE from 'three'
import { PLANET_SCALE, LOD_HIGH, LOD_MED, LOD_LOW } from '../utils/constants.js'
import { degToRad } from '../utils/MathUtils.js'
import earthVert from '../shaders/earth.vert.glsl?raw'
import earthFrag from '../shaders/earth.frag.glsl?raw'
import atmosphereVert from '../shaders/atmosphere.vert.glsl?raw'
import atmosphereFrag from '../shaders/atmosphere.frag.glsl?raw'

const EARTH_DATA_KEY = 'earth'

export class Earth {
  constructor(texManager, planetData) {
    this.group = new THREE.Group()
    this.group.rotation.z = degToRad(23.44)  // axial tilt

    const r = 1.0 * PLANET_SCALE  // Earth radius = PLANET_SCALE units

    // ── Custom day/night/clouds shader ────────────────────────────
    this._sunDir = new THREE.Vector3(1, 0, 0)

    this.earthUniforms = {
      uDayMap:        { value: texManager.load('/textures/earth/earth_daymap.jpg',    0x2244AA) },
      uNightMap:      { value: texManager.load('/textures/earth/earth_nightmap.jpg',  0x111122) },
      uCloudsMap:     { value: texManager.load('/textures/earth/earth_clouds.jpg',    0xCCCCCC) },
      uSpecularMap:   { value: texManager.load('/textures/earth/earth_specular.jpg',  0x111133) },
      uSunDirection:  { value: this._sunDir },
      uCloudTime:     { value: 0 },
      uAudioBass:     { value: 0 },
    }

    const earthMat = new THREE.ShaderMaterial({
      uniforms:       this.earthUniforms,
      vertexShader:   earthVert,
      fragmentShader: earthFrag,
    })
    earthMat.customProgramCacheKey = () => 'earth'

    this.lod = new THREE.LOD()
    const mkMesh = (segs) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, segs, segs / 2), earthMat)
      m.castShadow = m.receiveShadow = true
      return m
    }
    this.lod.addLevel(mkMesh(128), LOD_HIGH)
    this.lod.addLevel(mkMesh(64),  LOD_MED)
    this.lod.addLevel(mkMesh(32),  LOD_LOW)
    this.group.add(this.lod)

    // ── Atmosphere ─────────────────────────────────────────────────
    const ar = r * 1.028
    this.atmoUniforms = {
      uSunPosition:        { value: new THREE.Vector3(0, 0, 0) },
      uAtmosphereColor:    { value: new THREE.Vector3(0.35, 0.65, 1.0) },
      uAtmosphereStrength: { value: 1.2 },
      uOpacity:            { value: 0.9 },
    }

    const mkAtmo = (side) => new THREE.ShaderMaterial({
      uniforms:       this.atmoUniforms,
      vertexShader:   atmosphereVert,
      fragmentShader: atmosphereFrag,
      blending:       THREE.AdditiveBlending,
      transparent:    true,
      depthWrite:     false,
      side,
    })

    const atmoGeo = new THREE.SphereGeometry(ar, 64, 64)
    const atmoBack  = new THREE.Mesh(atmoGeo, mkAtmo(THREE.BackSide))
    const atmoFront = new THREE.Mesh(atmoGeo, mkAtmo(THREE.FrontSide))
    atmoBack.castShadow = atmoFront.castShadow = false
    this.group.add(atmoBack, atmoFront)
  }

  update(elapsed, sunWorldPos, audioData = {}) {
    // Earth rotates every Earth day
    const yearSecs  = 120
    const rotN = (2 * Math.PI) / (1.0 * 86400 * (yearSecs / 365.25))
    this.lod.rotation.y = rotN * elapsed

    // Update sun direction in shader
    const d = sunWorldPos.clone().sub(this.group.position).normalize()
    this._sunDir.copy(d)

    this.atmoUniforms.uSunPosition.value.copy(sunWorldPos)

    this.earthUniforms.uCloudTime.value = elapsed
    this.earthUniforms.uAudioBass.value = audioData.bass ?? 0
  }

  get mesh() { return this.group }
}
