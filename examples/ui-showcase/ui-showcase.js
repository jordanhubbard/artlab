// UI Showcase — interactive HTML controls overlaid on a 3D scene.
// Demonstrates: canvas-relative panels, buttons, sliders, hover tooltips,
// live stat readout — all positioned within the canvas container.

import * as Three from 'three'

const OBJECTS = [
  { name: 'Sphere',   color: 0x4466ff },
  { name: 'Box',      color: 0xff6644 },
  { name: 'Torus',    color: 0x44dd88 },
  { name: 'Cylinder', color: 0xffcc22 },
  { name: 'Octahedron', color: 0xcc44ff },
  { name: 'Cone',     color: 0xff4499 },
]

let _meshes, _panel, _statEl, _tooltip, _onMove, _onOut, _raycaster, _mouse
let _speed = 0.6, _wireframe = false, _shape = 'sphere', _bloom = false

// ── Build the HTML control panel ────────────────────────────────────────────

function buildUI(container, ctx) {
  // The container is the canvas parent — position relative to it
  container.style.position = 'relative'

  // ── Control panel (right side) ────────────────────────────────────────
  _panel = document.createElement('div')
  Object.assign(_panel.style, {
    position: 'absolute', top: '10px', right: '10px',
    width: '170px',
    background: 'rgba(8,10,22,0.88)',
    border: '1px solid rgba(80,120,255,0.3)',
    borderRadius: '4px',
    fontFamily: 'monospace', fontSize: '11px', color: '#889aaa',
    padding: '12px',
    display: 'flex', flexDirection: 'column', gap: '10px',
    userSelect: 'none',
    zIndex: '10',
  })

  _panel.innerHTML = `
    <div style="color:#5a8cff;letter-spacing:.15em;font-size:10px;border-bottom:1px solid rgba(80,120,255,.2);padding-bottom:6px">
      UI SHOWCASE
    </div>

    <div>
      <div style="margin-bottom:4px">Geometry</div>
      <div id="ui-shape-btns" style="display:flex;flex-direction:column;gap:3px"></div>
    </div>

    <div>
      <div style="margin-bottom:4px">Speed: <span id="ui-speed-val">${_speed.toFixed(1)}</span>×</div>
      <input id="ui-speed" type="range" min="0" max="2" step="0.1" value="${_speed}"
        style="width:100%;accent-color:#4466ff;cursor:pointer">
    </div>

    <div style="display:flex;flex-direction:column;gap:4px">
      <label id="ui-wire-lbl" style="cursor:pointer;display:flex;align-items:center;gap:6px">
        <input type="checkbox" id="ui-wire" style="accent-color:#4466ff;cursor:pointer">
        Wireframe
      </label>
      <label id="ui-bloom-lbl" style="cursor:pointer;display:flex;align-items:center;gap:6px">
        <input type="checkbox" id="ui-bloom" style="accent-color:#4466ff;cursor:pointer">
        Bloom
      </label>
    </div>

    <div id="ui-stats" style="border-top:1px solid rgba(80,120,255,.2);padding-top:6px;
      font-size:10px;color:#556677;line-height:1.8">
      —
    </div>
  `
  container.appendChild(_panel)
  _statEl = _panel.querySelector('#ui-stats')

  // Shape buttons
  const shapeBtns = _panel.querySelector('#ui-shape-btns')
  const shapes = ['sphere', 'box', 'torus', 'cylinder', 'cone']
  for (const s of shapes) {
    const btn = document.createElement('button')
    btn.textContent = s
    btn.dataset.shape = s
    Object.assign(btn.style, {
      background: s === _shape ? 'rgba(60,100,220,0.3)' : 'rgba(20,25,45,0.6)',
      border: `1px solid ${s === _shape ? 'rgba(80,140,255,0.6)' : 'rgba(80,100,180,0.2)'}`,
      color: s === _shape ? '#aaccff' : '#556677',
      fontFamily: 'monospace', fontSize: '11px',
      padding: '3px 8px', cursor: 'pointer', borderRadius: '3px',
      textAlign: 'left',
    })
    btn.addEventListener('click', () => {
      _shape = s
      _rebuildMeshes(ctx)
      // Update button styles
      shapeBtns.querySelectorAll('button').forEach(b => {
        const active = b.dataset.shape === _shape
        b.style.background = active ? 'rgba(60,100,220,0.3)' : 'rgba(20,25,45,0.6)'
        b.style.borderColor = active ? 'rgba(80,140,255,0.6)' : 'rgba(80,100,180,0.2)'
        b.style.color = active ? '#aaccff' : '#556677'
      })
    })
    shapeBtns.appendChild(btn)
  }

  // Speed slider
  _panel.querySelector('#ui-speed').addEventListener('input', e => {
    _speed = parseFloat(e.target.value)
    _panel.querySelector('#ui-speed-val').textContent = _speed.toFixed(1)
  })

  // Wireframe toggle
  _panel.querySelector('#ui-wire').addEventListener('change', e => {
    _wireframe = e.target.checked
    for (const m of _meshes) m.material.wireframe = _wireframe
  })

  // Bloom toggle
  _panel.querySelector('#ui-bloom').addEventListener('change', e => {
    _bloom = e.target.checked
    ctx.setBloom(_bloom ? 0.8 : 0)
  })

  // ── Hover tooltip ──────────────────────────────────────────────────────
  _tooltip = document.createElement('div')
  Object.assign(_tooltip.style, {
    position: 'absolute', pointerEvents: 'none',
    background: 'rgba(8,10,22,0.92)',
    border: '1px solid rgba(80,140,255,0.4)',
    borderRadius: '3px', padding: '5px 10px',
    fontFamily: 'monospace', fontSize: '11px', color: '#aaccff',
    display: 'none', zIndex: '20',
  })
  container.appendChild(_tooltip)
}

// ── Rebuild meshes when shape changes ────────────────────────────────────────

function _makeGeo(shape) {
  switch (shape) {
    case 'box':      return new Three.BoxGeometry(1, 1, 1)
    case 'torus':    return new Three.TorusGeometry(0.5, 0.2, 16, 40)
    case 'cylinder': return new Three.CylinderGeometry(0.4, 0.4, 1, 32)
    case 'cone':     return new Three.ConeGeometry(0.5, 1, 32)
    default:         return new Three.SphereGeometry(0.6, 28, 16)
  }
}

function _rebuildMeshes(ctx) {
  // Remove old meshes from scene
  for (const m of (_meshes || [])) ctx.remove(m)
  _meshes = []
  const geo = _makeGeo(_shape)
  for (let i = 0; i < OBJECTS.length; i++) {
    const { name, color } = OBJECTS[i]
    const mat = new Three.MeshStandardMaterial({
      color, roughness: 0.35, metalness: 0.2,
      emissive: new Three.Color(color).multiplyScalar(0.12),
      wireframe: _wireframe,
    })
    const m = new Three.Mesh(geo, mat)
    m.userData.label = name
    m.userData.hex = '#' + color.toString(16).padStart(6, '0')
    const angle = (i / OBJECTS.length) * Math.PI * 2
    m.position.set(Math.cos(angle) * 3, 0, Math.sin(angle) * 3)
    ctx.add(m)
    _meshes.push(m)
  }
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

export function setup(ctx) {
  ctx.setHelp('Hover a shape to see its tooltip   •   Use the on-screen controls to change shape')
  ctx.camera.position.set(0, 4, 10)
  ctx.camera.lookAt(0, 0, 0)

  ctx.add(new Three.AmbientLight(0x223355, 0.7))
  const sun = new Three.DirectionalLight(0xffffff, 1.3)
  sun.position.set(5, 8, 6)
  ctx.add(sun)
  const rim = new Three.PointLight(0x4466ff, 1.0, 30)
  rim.position.set(-6, 4, -5)
  ctx.add(rim)

  _rebuildMeshes(ctx)

  const container = ctx.renderer.domElement.parentElement
  buildUI(container, ctx)

  // Raycasting for tooltip
  _raycaster = new Three.Raycaster()
  _mouse = new Three.Vector2(-9, -9)

  _onMove = (e) => {
    const rect = ctx.renderer.domElement.getBoundingClientRect()
    _mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1
    _mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1

    _raycaster.setFromCamera(_mouse, ctx.camera)
    const hits = _raycaster.intersectObjects(_meshes)
    if (hits.length > 0) {
      const obj = hits[0].object
      _tooltip.textContent = `${obj.userData.label}  ${obj.userData.hex}`
      _tooltip.style.display = 'block'
      // Position relative to container
      const cRect = container.getBoundingClientRect()
      _tooltip.style.left = (e.clientX - cRect.left + 12) + 'px'
      _tooltip.style.top  = (e.clientY - cRect.top  - 14) + 'px'
    } else {
      _tooltip.style.display = 'none'
    }
  }
  _onOut = () => { _tooltip.style.display = 'none' }

  window.addEventListener('mousemove', _onMove)
  ctx.renderer.domElement.addEventListener('mouseleave', _onOut)
}

export function update(ctx, dt) {
  const t = ctx.elapsed
  for (let i = 0; i < _meshes.length; i++) {
    const m = _meshes[i]
    const angle = (i / _meshes.length) * Math.PI * 2 + t * _speed * 0.3
    m.position.set(Math.cos(angle) * 3, Math.sin(t * _speed * 0.5 + i * 0.8) * 0.8, Math.sin(angle) * 3)
    m.rotation.y += _speed * 0.6 * dt
    m.rotation.x += _speed * 0.2 * dt
  }

  // Update stat panel
  if (_statEl) {
    _statEl.innerHTML =
      `elapsed: ${t.toFixed(1)}s<br>` +
      `objects: ${_meshes.length}<br>` +
      `shape: ${_shape}<br>` +
      `speed: ${_speed.toFixed(1)}×`
  }
}

export function teardown(ctx) {
  window.removeEventListener('mousemove', _onMove)
  ctx.renderer.domElement?.removeEventListener('mouseleave', _onOut)
  _panel?.remove()
  _tooltip?.remove()
  for (const m of (_meshes || [])) ctx.remove(m)
}
