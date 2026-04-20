// chroma-mirror.js — Webcam with chroma key compositing onto a rotating 3D background scene.

import * as THREE from 'three'
import { webcam, chromaKey, videoPlane } from '../../src/stdlib/video.js'

const SHAPE_COUNT = 18
const PALETTE     = [0xff3366, 0x33ccff, 0xffcc00, 0xff6600, 0x66ff99, 0xcc33ff, 0xff99cc, 0x00ccff]
const PLANE_W     = 4.5
const PLANE_H     = PLANE_W * (720 / 1280)

let _cam    = null
let _plane  = null
let _shapes = []
let _lights = []
let _note   = null

export async function setup(ctx) {
  ctx.camera.position.set(0, 0, 8)
  ctx.setBloom(0.5)

  const ambient = new THREE.AmbientLight(0x112244, 2.0)
  ctx.add(ambient)
  _lights.push(ambient)

  const pointLight = new THREE.PointLight(0xffffff, 1.5, 40)
  pointLight.position.set(3, 6, -4)
  ctx.add(pointLight)
  _lights.push(pointLight)

  const geoBox    = new THREE.BoxGeometry(1.2, 1.2, 1.2)
  const geoSphere = new THREE.SphereGeometry(0.65, 20, 16)
  const geoTorus  = new THREE.TorusGeometry(0.55, 0.2, 14, 48)
  const geos      = [geoBox, geoSphere, geoTorus]

  for (let i = 0; i < SHAPE_COUNT; i++) {
    const color = PALETTE[i % PALETTE.length]
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: new THREE.Color(color),
      emissiveIntensity: 0.35,
      roughness: 0.3,
      metalness: 0.6,
    })
    const mesh = new THREE.Mesh(geos[i % geos.length], mat)

    const angle  = (i / SHAPE_COUNT) * Math.PI * 2 + 0.3
    const radius = 3 + (i % 4) * 1.5
    mesh.position.set(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius * 0.5,
      -2 - (i % 5) * 1.8,
    )
    mesh.rotation.set(i * 0.8, i * 1.1, i * 0.5)
    mesh.userData.spinX = ((i % 3) - 1) * 0.25
    mesh.userData.spinY = ((i % 5) - 2) * 0.3
    mesh.userData.spinZ = ((i % 4) - 1.5) * 0.15

    ctx.add(mesh)
    _shapes.push(mesh)
  }

  const container = ctx.renderer.domElement.parentElement
  container.style.position = 'relative'

  if (!navigator.mediaDevices?.getUserMedia) {
    _note = _buildNote(container)
    return
  }

  await _awaitGesture(container)

  _cam = webcam({ width: 1280, height: 720 })
  const keyMat = chromaKey(_cam.texture)
  _plane = videoPlane(_cam, { width: PLANE_W, height: PLANE_H, material: keyMat })
  _plane.position.set(0, 0, 1.5)
  ctx.add(_plane)
}

export function update(_ctx, dt) {
  for (const mesh of _shapes) {
    mesh.rotation.x += mesh.userData.spinX * dt
    mesh.rotation.y += mesh.userData.spinY * dt
    mesh.rotation.z += mesh.userData.spinZ * dt
  }
}

export function teardown(ctx) {
  _cam?.stop()
  _cam = null

  if (_plane) {
    ctx.remove(_plane)
    _plane = null
  }

  for (const mesh of _shapes) ctx.remove(mesh)
  _shapes = []

  for (const light of _lights) ctx.remove(light)
  _lights = []

  _note?.remove()
  _note = null
}

function _awaitGesture(container) {
  return new Promise(resolve => {
    const btn = document.createElement('button')
    Object.assign(btn.style, {
      position:      'absolute',
      bottom:        '50%',
      left:          '50%',
      transform:     'translate(-50%, 50%)',
      background:    'rgba(10,12,30,0.92)',
      border:        '1px solid rgba(120,180,255,0.45)',
      color:         '#aaddff',
      padding:       '14px 44px',
      cursor:        'pointer',
      fontSize:      '13px',
      borderRadius:  '4px',
      zIndex:        '100',
      fontFamily:    'monospace',
      letterSpacing: '0.22em',
    })
    btn.textContent = 'Allow Camera'
    container.appendChild(btn)
    btn.addEventListener('click', () => { btn.remove(); resolve() }, { once: true })
  })
}

function _buildNote(container) {
  const el = document.createElement('div')
  Object.assign(el.style, {
    position:      'absolute',
    bottom:        '40px',
    left:          '50%',
    transform:     'translateX(-50%)',
    background:    'rgba(10,14,32,0.85)',
    border:        '1px solid rgba(80,120,200,0.35)',
    color:         '#7799bb',
    padding:       '10px 24px',
    fontFamily:    'monospace',
    fontSize:      '11px',
    letterSpacing: '0.14em',
    pointerEvents: 'none',
    zIndex:        '50',
    whiteSpace:    'nowrap',
  })
  el.textContent = 'Webcam unavailable — background scene only'
  container.appendChild(el)
  return el
}
