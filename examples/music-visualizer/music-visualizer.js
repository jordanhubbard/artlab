// music-visualizer — 3 concentric torus rings pulsing with bass/mid/treble FFT bands.
import * as Three from 'three'
import { ResourceScope, ParticleField, GestureButton } from '../../src/stdlib/scene.js'
import { MicrophoneInput } from '../../src/stdlib/media.js'

const RING_COUNT = 3
const BANDS = [
  { name: 'bass',   lo: 0,   hi: 0.15, baseR: 2.0, tube: 0.12, color: 0xff2266, scale: 2.5 },
  { name: 'mid',    lo: 0.15, hi: 0.5,  baseR: 3.2, tube: 0.10, color: 0x22ccff, scale: 2.0 },
  { name: 'treble', lo: 0.5,  hi: 1.0,  baseR: 4.2, tube: 0.08, color: 0xaaff44, scale: 1.5 },
]
const PARTICLE_COUNT = 300
const FFT_SIZE = 256

function overlayContainer(ctx) {
  return ctx.renderer?.domElement?.parentElement
    ?? document.getElementById('canvas-container')
    ?? document.body
}

export async function setup(ctx) {
  const scope = ctx._scope = new ResourceScope()
  ctx.setHelp('Click Start to enable microphone — rings pulse with bass / mid / treble')
  ctx.camera.position.set(0, 4, 10)
  ctx.camera.lookAt(0, 0, 0)
  ctx.setBloom(1.2)

  const ambient = new Three.AmbientLight(0x111122, 0.8)
  scope.add(ctx, ambient)
  const pt = new Three.PointLight(0xffffff, 1.5, 30)
  pt.position.set(0, 5, 5)
  scope.add(ctx, pt)
  ctx._lights = [ambient, pt]

  ctx._microphone = scope.own(new MicrophoneInput({ fftSize: FFT_SIZE }))
  const gesture = scope.own(new GestureButton(overlayContainer(ctx), {
    label: 'Start Visualizer', start: () => ctx._microphone.start(),
  }))
  ctx._startBtn = gesture.button

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
    scope.add(ctx, mesh)
    return { mesh, band, baseScale: 1.0 }
  })

  // Sparkle particles
  const field = scope.own(new ParticleField(PARTICLE_COUNT, { size: 0.06, opacity: 0.7 }))
  const { positions, colors } = field
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
  field.commit()
  ctx._particles = field.object
  ctx.add(field.object)
  scope.defer(() => ctx.remove(field.object))

  ctx._camAngle = 0
}

export function update(ctx, dt) {
  let levels = [0, 0, 0]

  ctx._microphone.update()
  if (ctx._microphone.active) {
    levels = BANDS.map(b => ctx._microphone.level(b.lo, b.hi))
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

export function teardown(ctx) { return ctx._scope.dispose() }
