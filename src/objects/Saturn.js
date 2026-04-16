import * as THREE from 'three'
import { PLANET_SCALE, LOD_HIGH, LOD_MED, LOD_LOW } from '../utils/constants.js'
import { degToRad } from '../utils/MathUtils.js'
import atmosphereVert from '../shaders/atmosphere.vert.glsl?raw'
import atmosphereFrag from '../shaders/atmosphere.frag.glsl?raw'
import ringVert from '../shaders/saturn_rings.vert.glsl?raw'
import ringFrag from '../shaders/saturn_rings.frag.glsl?raw'

export class Saturn {
  constructor(texManager, data) {
    this.data  = data
    this.group = new THREE.Group()
    this.group.rotation.z = degToRad(data.axialTilt ?? 26.73)

    const r = data.radius * PLANET_SCALE

    // ── Planet sphere ──────────────────────────────────────────────
    const mat = new THREE.MeshStandardMaterial({
      map:       texManager.load(data.textures.map, data.color),
      roughness: data.roughness ?? 0.85,
      metalness: 0,
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

    // ── Ring system ────────────────────────────────────────────────
    const ringInnerR = r * (data.ringInner ?? 1.11)
    const ringOuterR = r * (data.ringOuter ?? 2.27)

    this.ringUniforms = {
      uRingTexture: { value: this._makeRingTexture() },
      uSunDir:      { value: new THREE.Vector3(1, 0, 0) },
      uSaturnPos:   { value: new THREE.Vector3() },
      uInnerRadius: { value: ringInnerR },
      uOuterRadius: { value: ringOuterR },
    }

    const ringMat = new THREE.ShaderMaterial({
      uniforms:       this.ringUniforms,
      vertexShader:   ringVert,
      fragmentShader: ringFrag,
      transparent:    true,
      depthWrite:     false,
      side:           THREE.DoubleSide,
    })

    // RingGeometry(innerR, outerR, thetaSegments)
    const ringGeo = new THREE.RingGeometry(ringInnerR, ringOuterR, 128)
    this._fixRingUVs(ringGeo, ringInnerR, ringOuterR)

    this.rings = new THREE.Mesh(ringGeo, ringMat)
    this.rings.castShadow    = false
    this.rings.receiveShadow = true
    this.group.add(this.rings)

    // ── Atmosphere haze ────────────────────────────────────────────
    const ar = r * 1.01
    this.atmoUniforms = {
      uSunPosition:        { value: new THREE.Vector3() },
      uAtmosphereColor:    { value: new THREE.Vector3(0.85, 0.75, 0.5) },
      uAtmosphereStrength: { value: 0.4 },
      uOpacity:            { value: 0.5 },
    }
    const atmoGeo = new THREE.SphereGeometry(ar, 48, 48)
    const mkAtmo = (side) => new THREE.ShaderMaterial({
      uniforms: this.atmoUniforms, vertexShader: atmosphereVert,
      fragmentShader: atmosphereFrag, blending: THREE.AdditiveBlending,
      transparent: true, depthWrite: false, side,
    })
    this.group.add(new THREE.Mesh(atmoGeo, mkAtmo(THREE.FrontSide)))
  }

  /** Fix RingGeometry UV so U = radial (0=inner, 1=outer).
   *  Three.js RingGeometry lies in the XY plane (z=0 per vertex). */
  _fixRingUVs(geo, innerR, outerR) {
    const pos = geo.attributes.position
    const uv  = geo.attributes.uv
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i)
      const dist = Math.sqrt(x * x + y * y)
      const u = (dist - innerR) / (outerR - innerR)
      uv.setXY(i, u, 0.5)
    }
    uv.needsUpdate = true
  }

  _makeRingTexture(size = 512) {
    const canvas = document.createElement('canvas')
    canvas.width = size; canvas.height = 4
    const ctx = canvas.getContext('2d')
    const grad = ctx.createLinearGradient(0, 0, size, 0)
    // D ring (faint inner)
    grad.addColorStop(0.00, 'rgba(80,65,50,0)')
    grad.addColorStop(0.05, 'rgba(80,65,50,0.3)')
    // C ring
    grad.addColorStop(0.08, 'rgba(100,80,60,0.45)')
    grad.addColorStop(0.22, 'rgba(110,90,65,0.55)')
    // B ring (brightest)
    grad.addColorStop(0.25, 'rgba(200,175,140,0.85)')
    grad.addColorStop(0.35, 'rgba(215,190,155,0.95)')
    grad.addColorStop(0.42, 'rgba(205,180,145,0.9)')
    grad.addColorStop(0.50, 'rgba(190,165,130,0.88)')
    // Cassini division
    grad.addColorStop(0.55, 'rgba(15,10,8,0.05)')
    grad.addColorStop(0.58, 'rgba(15,10,8,0.05)')
    // A ring
    grad.addColorStop(0.60, 'rgba(180,155,120,0.7)')
    grad.addColorStop(0.74, 'rgba(170,145,110,0.65)')
    // Encke gap
    grad.addColorStop(0.82, 'rgba(20,15,10,0.1)')
    grad.addColorStop(0.85, 'rgba(160,135,100,0.5)')
    // F ring (faint outer)
    grad.addColorStop(0.92, 'rgba(140,115,85,0.2)')
    grad.addColorStop(1.00, 'rgba(140,115,85,0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, size, 4)
    const tex = new THREE.CanvasTexture(canvas)
    tex.wrapS = THREE.ClampToEdgeWrapping
    tex.wrapT = THREE.ClampToEdgeWrapping
    return tex
  }

  update(elapsed, sunWorldPos, audioData = {}) {
    const yearSecs = 120
    const rotN = (2 * Math.PI) / (this.data.rotationPeriod * 86400 * (yearSecs / 365.25))
    this.lod.rotation.y = rotN * elapsed

    if (sunWorldPos) {
      const sunDir = sunWorldPos.clone().sub(this.group.position).normalize()
      this.ringUniforms.uSunDir.value.copy(sunDir)
      this.atmoUniforms.uSunPosition.value.copy(sunWorldPos)
      this.ringUniforms.uSaturnPos.value.copy(this.group.position)
    }
  }

  get mesh() { return this.group }
}
