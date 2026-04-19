// UI Showcase — 5 labeled floating spheres with HUD overlay, progress bar, and hover tooltip.

import * as THREE from 'three'
import { label, hud, progressBar, tooltip } from '../../src/stdlib/ui.js'

const NAMES  = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon']
const COLORS = [0xff4466, 0xffaa00, 0x44ff88, 0x44aaff, 0xcc44ff]

export function setup(ctx) {
  ctx.camera.position.set(0, 2, 14)
  ctx.camera.lookAt(0, 2, 0)
  ctx.add(new THREE.AmbientLight(0x222233, 1.0))
  const ptLight = new THREE.PointLight(0xffffff, 1.5, 40)
  ptLight.position.set(0, 8, 6)
  ctx.add(ptLight)

  ctx._spheres = []
  ctx._labels  = []
  ctx._geo = new THREE.SphereGeometry(0.6, 24, 16)

  for (let i = 0; i < NAMES.length; i++) {
    const mat  = new THREE.MeshStandardMaterial({ color: COLORS[i], emissive: new THREE.Color(COLORS[i]), emissiveIntensity: 0.3, roughness: 0.4, metalness: 0.5 })
    const mesh = new THREE.Mesh(ctx._geo, mat)
    mesh.position.set((i - 2) * 2.6, 1.5 + i * 0.8, 0)
    mesh.userData.name = NAMES[i]
    ctx.add(mesh)
    ctx._spheres.push(mesh)

    const lbl = label(mesh, NAMES[i], { color: '#aaddff', fontSize: '13px', offsetY: 1.0 })
    ctx._labels.push(lbl)
  }

  ctx._hudTitle   = hud({ position: 'top-left' })
  ctx._hudTitle.setText('UI SHOWCASE — artlab/ui')

  ctx._hudTimer   = hud({ position: 'bottom-right' })

  ctx._bar = progressBar({ position: 'bottom-left', label: 'CYCLE', width: 200, color: '#44aaff' })

  ctx._tip = tooltip()

  const raycaster = new THREE.Raycaster()
  const mouse     = new THREE.Vector2()

  ctx._onMove = (e) => {
    mouse.x = (e.clientX / window.innerWidth)  * 2 - 1
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1
    raycaster.setFromCamera(mouse, ctx.camera)
    const hits = raycaster.intersectObjects(ctx._spheres)
    if (hits.length > 0) {
      const obj = hits[0].object
      const hex = '#' + obj.material.color.getHexString()
      ctx._tip.show(`${obj.userData.name}  ${hex}`, e.clientX, e.clientY)
    } else {
      ctx._tip.hide()
    }
  }
  window.addEventListener('mousemove', ctx._onMove)
}

export function update(ctx, dt) {
  const t = ctx.elapsed

  for (let i = 0; i < ctx._spheres.length; i++) {
    const hue  = ((t * 0.08 + i * 0.2) % 1)
    const col  = new THREE.Color().setHSL(hue, 0.8, 0.55)
    ctx._spheres[i].material.color.copy(col)
    ctx._spheres[i].material.emissive.copy(col)
    ctx._spheres[i].position.y = 1.5 + i * 0.8 + Math.sin(t * 0.6 + i) * 0.3
  }

  ctx._hudTimer.setText(t.toFixed(1) + 's')
  ctx._bar.setValue((t % 10) / 10)
}

export function teardown(ctx) {
  window.removeEventListener('mousemove', ctx._onMove)
  for (const l of ctx._labels)  l.detach()
  for (const s of ctx._spheres) { s.material.dispose(); ctx.remove(s) }
  ctx._geo.dispose()
  ctx._hudTitle.dispose()
  ctx._hudTimer.dispose()
  ctx._bar.dispose()
  ctx._tip.dispose()
}
