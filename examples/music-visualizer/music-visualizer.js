// music-visualizer — 3 concentric torus rings pulsing with bass/mid/treble FFT bands.
import * as Three from 'three'

const RING_COUNT = 3
const BANDS = [
  { name: 'bass',   lo: 0,   hi: 0.15, baseR: 2.0, tube: 0.12, color: 0xff2266, scale: 2.5 },
  { name: 'mid',    lo: 0.15, hi: 0.5,  baseR: 3.2, tube: 0.10, color: 0x22ccff, scale: 2.0 },
  { name: 'treble', lo: 0.5,  hi: 1.0,  baseR: 4.2, tube: 0.08, color: 0xaaff44, scale: 1.5 },
]
const PARTICLE_COUNT = 300
const FFT_SIZE = 256

export async function setup(ctx) {
  ctx.setHelp('Click Start to enable microphone — rings pulse with bass / mid / treble')
  ctx.camera.position.set(0, 4, 10)
  ctx.camera.lookAt(0, 0, 0)
  ctx.setBloom(1.2)

  const ambient = new Three.AmbientLight(0x111122, 0.8)
  ctx.add(ambient)
  const pt = new Three.PointLight(0xffffff, 1.5, 30)
  pt.position.set(0, 5, 5)
  ctx.add(pt)
  ctx._lights = [ambient, pt]

  // FFT setup — wired up from the start button (requires user gesture)
  ctx._audioCtx = null
  ctx._analyser = null
  ctx._fftData = null
  ctx._stream = null

  const container = ctx.renderer.domElement.parentElement
  ctx._startBtn = document.createElement('button')
  Object.assign(ctx._startBtn.style, {
    position: 'absolute', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
    background: 'rgba(10,14,36,0.92)', border: '1px solid rgba(80,140,255,0.5)',
    color: '#88aaff', padding: '11px 36px', cursor: 'pointer',
    fontFamily: 'monospace', fontSize: '12px', letterSpacing: '.25em',
    borderRadius: '3px', zIndex: '100',
  })
  ctx._startBtn.textContent = 'Start Visualizer'
  container.appendChild(ctx._startBtn)

  ctx._startBtn.addEventListener('click', async () => {
    ctx._startBtn.style.display = 'none'
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      ctx._stream = stream
      ctx._audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      const source = ctx._audioCtx.createMediaStreamSource(stream)
      const analyser = ctx._audioCtx.createAnalyser()
      analyser.fftSize = FFT_SIZE
      source.connect(analyser)
      ctx._analyser = analyser
      ctx._fftData = new Uint8Array(analyser.frequencyBinCount)
    } catch (_e) {
      ctx._analyser = null
    }
  }, { once: true })

  // Create rings
  ctx._rings = BANDS.map(band => {
    const geo = new Three.TorusGeometry(band.baseR, band.tube, 32, 100)
    const mat = new Three.MeshStandardMaterial({
      color: band.color,
      emissive: new Three.Color(band.color).multiplyScalar(0.3),
      roughness: 0.3,
      metalness: 0.6,
    })
    const mesh = new Three.Mesh(geo, mat)
    ctx.add(mesh)
    return { mesh, band, baseScale: 1.0 }
  })

  // Sparkle particles
  const sparkGeo = new Three.BufferGeometry()
  const positions = new Float32Array(PARTICLE_COUNT * 3)
  const colors = new Float32Array(PARTICLE_COUNT * 3)
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const theta = Math.random() * Math.PI * 2
    const r = 1.5 + Math.random() * 4
    const y = (Math.random() - 0.5) * 3
    positions[i * 3] = Math.cos(theta) * r
    positions[i * 3 + 1] = y
    positions[i * 3 + 2] = Math.sin(theta) * r
    colors[i * 3] = 0.5 + Math.random() * 0.5
    colors[i * 3 + 1] = 0.5 + Math.random() * 0.5
    colors[i * 3 + 2] = 0.8 + Math.random() * 0.2
  }
  sparkGeo.setAttribute('position', new Three.BufferAttribute(positions, 3))
  sparkGeo.setAttribute('color', new Three.BufferAttribute(colors, 3))
  sparkGeo.attributes.position.setUsage(Three.DynamicDrawUsage)
  const sparkMat = new Three.PointsMaterial({
    size: 0.06, vertexColors: true, transparent: true, opacity: 0.7,
    blending: Three.AdditiveBlending, depthWrite: false,
  })
  ctx._particles = new Three.Points(sparkGeo, sparkMat)
  ctx.add(ctx._particles)

  ctx._camAngle = 0
}

function getBandLevel(fftData, lo, hi) {
  if (!fftData) return 0
  const len = fftData.length
  const start = Math.floor(lo * len)
  const end = Math.floor(hi * len)
  let sum = 0
  for (let i = start; i < end; i++) sum += fftData[i]
  return sum / ((end - start) * 255)
}

export function update(ctx, dt) {
  let levels = [0, 0, 0]

  if (ctx._analyser && ctx._fftData) {
    ctx._analyser.getByteFrequencyData(ctx._fftData)
    levels = BANDS.map(b => getBandLevel(ctx._fftData, b.lo, b.hi))
  } else {
    // Sine fallback
    levels = [
      0.4 + 0.4 * Math.sin(ctx.elapsed * 2.1),
      0.3 + 0.3 * Math.sin(ctx.elapsed * 3.7 + 1),
      0.2 + 0.3 * Math.sin(ctx.elapsed * 5.3 + 2),
    ]
  }

  // Pulse rings
  for (let i = 0; i < ctx._rings.length; i++) {
    const { mesh, band } = ctx._rings[i]
    const level = levels[i]
    const s = 1.0 + level * band.scale
    mesh.scale.set(s, s, s)
    mesh.rotation.x = ctx.elapsed * (0.3 + i * 0.15)
    mesh.rotation.y = ctx.elapsed * (0.2 + i * 0.1)
    mesh.material.emissiveIntensity = 0.3 + level * 2.0
  }

  // Animate particles
  const pos = ctx._particles.geometry.attributes.position
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const bandIdx = i % 3
    const level = levels[bandIdx]
    let y = pos.getY(i)
    y += (0.5 + level * 2.0) * dt
    if (y > 4) y = -4
    pos.setY(i, y)
    const x = pos.getX(i)
    const z = pos.getZ(i)
    const a = Math.atan2(z, x) + dt * 0.3
    const r = Math.sqrt(x * x + z * z)
    pos.setX(i, Math.cos(a) * r)
    pos.setZ(i, Math.sin(a) * r)
  }
  pos.needsUpdate = true

  // Camera orbit
  ctx._camAngle += dt * 0.12
  ctx.camera.position.set(
    Math.sin(ctx._camAngle) * 10,
    3 + Math.sin(ctx.elapsed * 0.4) * 1.5,
    Math.cos(ctx._camAngle) * 10,
  )
  ctx.camera.lookAt(0, 0, 0)
}

export function teardown(ctx) {
  ctx._startBtn?.remove()
  for (const { mesh } of ctx._rings) ctx.remove(mesh)
  ctx.remove(ctx._particles)
  ctx._particles.geometry.dispose()
  ctx._particles.material.dispose()
  for (const l of ctx._lights) ctx.remove(l)
  if (ctx._stream) ctx._stream.getTracks().forEach(t => t.stop())
  if (ctx._audioCtx) ctx._audioCtx.close()
}
