import * as THREE from 'three'
import { PLANET_SCALE, LOD_HIGH, LOD_MED, LOD_LOW, LOD_TINY } from '../utils/constants.js'
import { degToRad } from '../utils/MathUtils.js'
import atmosphereVert from '../shaders/atmosphere.vert.glsl?raw'
import atmosphereFrag from '../shaders/atmosphere.frag.glsl?raw'

export class Planet {
  /**
   * @param {object} data       - from planetData.js
   * @param {TextureManager} texManager
   */
  constructor(data, texManager) {
    this.data       = data
    this._texManager = texManager
    this.group      = new THREE.Group()

    const r = data.radius * PLANET_SCALE
    this._radius = r

    // ── Planet sphere with LOD ──────────────────────────────────────
    this.lod = new THREE.LOD()
    this.lod.rotation.z = degToRad(data.axialTilt ?? 0)

    const diffuse  = texManager.load(data.textures.map, data.color)
    const normalTx = data.textures?.normal  ? texManager.load(data.textures.normal,   0x8080ff) : null
    const roughTx  = data.textures?.roughness ? texManager.load(data.textures.roughness, 0x888888) : null

    const mat = new THREE.MeshStandardMaterial({
      map:        diffuse,
      normalMap:  normalTx,
      roughnessMap: roughTx,
      roughness:  data.roughness ?? 0.85,
      metalness:  data.metalness ?? 0.0,
    })

    const makeLevel = (segs) => new THREE.Mesh(new THREE.SphereGeometry(r, segs, segs / 2), mat)
    this.lod.addLevel(makeLevel(128), LOD_HIGH)
    this.lod.addLevel(makeLevel(64),  LOD_MED)
    this.lod.addLevel(makeLevel(32),  LOD_LOW)
    this.lod.addLevel(makeLevel(16),  LOD_TINY)

    this.lod.castShadow    = true
    this.lod.receiveShadow = true
    this.group.add(this.lod)

    // ── Atmosphere (if planet has one) ─────────────────────────────
    if (data.atmosphereScale && data.atmosphereScale > 0) {
      this._buildAtmosphere(r, data)
    }

    // The "mesh" property is what OrbitalMechanics positions
    // (the outer group, so atmosphere follows the planet)
  }

  _buildAtmosphere(r, data) {
    const ar = r * data.atmosphereScale
    const [cr, cg, cb] = data.atmosphereColor ?? [0.3, 0.6, 1.0]

    this.atmosphereUniforms = {
      uSunPosition:        { value: new THREE.Vector3(0, 0, 0) },
      uAtmosphereColor:    { value: new THREE.Vector3(cr, cg, cb) },
      uAtmosphereStrength: { value: 1.0 },
      uOpacity:            { value: 0.85 },
    }

    const makeAtmoMat = (side) => new THREE.ShaderMaterial({
      uniforms:       this.atmosphereUniforms,
      vertexShader:   atmosphereVert,
      fragmentShader: atmosphereFrag,
      blending:       THREE.AdditiveBlending,
      transparent:    true,
      depthWrite:     false,
      side,
    })

    const geo = new THREE.SphereGeometry(ar, 64, 64)

    // Back side (inside atmosphere when camera is very close)
    const atmoBack = new THREE.Mesh(geo, makeAtmoMat(THREE.BackSide))
    atmoBack.castShadow = atmoBack.receiveShadow = false
    this.group.add(atmoBack)

    // Front side (limb glow seen from far)
    const atmoFront = new THREE.Mesh(geo, makeAtmoMat(THREE.FrontSide))
    atmoFront.castShadow = atmoFront.receiveShadow = false
    this.group.add(atmoFront)

    this._atmoBack  = atmoBack
    this._atmoFront = atmoFront
  }

  /** Called each frame */
  update(elapsed, sunPosition, audioData = {}) {
    // Self-rotation via the LOD (inner sphere rotates, group stays at orbit position)
    const rotPeriod = this.data.rotationPeriod * 86400  // days → seconds
    const yearSecs  = 120  // from constants
    const rotN      = (2 * Math.PI) / (Math.abs(rotPeriod) * (yearSecs / 365.25))
    const rotDir    = rotPeriod < 0 ? -1 : 1
    this.lod.rotation.y = rotDir * rotN * elapsed

    // Keep atmosphere uniforms pointing at the Sun
    if (this.atmosphereUniforms) {
      this.atmosphereUniforms.uSunPosition.value.copy(sunPosition)
    }
  }

  /** The object OrbitalMechanics will position */
  get mesh() { return this.group }
}
