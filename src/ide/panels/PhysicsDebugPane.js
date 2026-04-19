/**
 * PhysicsDebugPane — IDE panel for visualising and inspecting the physics
 * simulation running inside the active scene.
 *
 * Usage:
 *   const pane = new PhysicsDebugPane(containerEl)
 *
 *   // When a scene is (re-)loaded:
 *   pane.attach(composer, scene)
 *
 *   // Inside the animation loop, after composer.step():
 *   pane.update()
 */

import { DebugRenderer } from '../../physics/DebugRenderer.js'

// ── Styles ───────────────────────────────────────────────────────────────────

const PANEL_CSS = `
  .phys-panel {
    background: #1a1a2e;
    color: #c9d1d9;
    font-family: 'Consolas', 'Menlo', 'Monaco', monospace;
    font-size: 12px;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .phys-header {
    background: #16213e;
    color: #58a6ff;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 6px 10px;
    border-bottom: 1px solid #30363d;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .phys-toggle-label {
    display: flex;
    align-items: center;
    gap: 5px;
    cursor: pointer;
    user-select: none;
    font-size: 11px;
    color: #8b949e;
    text-transform: none;
    letter-spacing: normal;
    font-weight: normal;
  }
  .phys-toggle-label input[type=checkbox] {
    accent-color: #58a6ff;
    cursor: pointer;
  }
  .phys-toggle-label:hover { color: #c9d1d9; }
  .phys-body {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  .phys-body::-webkit-scrollbar { width: 6px; }
  .phys-body::-webkit-scrollbar-track { background: transparent; }
  .phys-body::-webkit-scrollbar-thumb { background: #30363d; border-radius: 3px; }

  /* Stats bar */
  .phys-stats {
    display: flex;
    gap: 0;
    border-bottom: 1px solid #30363d;
    flex-shrink: 0;
  }
  .phys-stat {
    flex: 1;
    padding: 5px 8px;
    border-right: 1px solid #30363d;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .phys-stat:last-child { border-right: none; }
  .phys-stat-label {
    color: #484f58;
    font-size: 9px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .phys-stat-value {
    color: #79c0ff;
    font-size: 13px;
    font-weight: 600;
  }

  /* Section heading inside body */
  .phys-section-heading {
    color: #484f58;
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 6px 10px 3px;
    flex-shrink: 0;
  }

  /* Body list */
  .phys-body-list {
    flex: 1;
    overflow-y: auto;
  }
  .phys-body-item {
    display: flex;
    align-items: center;
    padding: 4px 10px;
    border-bottom: 1px solid #21262d;
    cursor: pointer;
    gap: 8px;
    transition: background 0.1s;
  }
  .phys-body-item:hover  { background: #21262d; }
  .phys-body-item.active { background: #1f3a5f; }
  .phys-body-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .dot-orbital  { background: #00ff00; }
  .dot-rigid    { background: #ffff00; }
  .dot-particle { background: #00ffff; }
  .phys-body-id {
    color: #8b949e;
    font-size: 11px;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .phys-body-pos {
    color: #484f58;
    font-size: 10px;
    white-space: nowrap;
  }
  .empty-state {
    color: #484f58;
    padding: 20px 14px;
    text-align: center;
    font-style: italic;
  }

  /* Detail panel */
  .phys-detail {
    border-top: 1px solid #30363d;
    background: #0d1117;
    padding: 8px 10px;
    flex-shrink: 0;
    font-size: 11px;
    min-height: 80px;
  }
  .phys-detail-title {
    color: #58a6ff;
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: 5px;
  }
  .phys-detail-row {
    display: flex;
    gap: 6px;
    padding: 2px 0;
    border-bottom: 1px solid #21262d;
  }
  .phys-detail-row:last-child { border-bottom: none; }
  .phys-detail-key {
    color: #8b949e;
    min-width: 70px;
    flex-shrink: 0;
  }
  .phys-detail-val { color: #c9d1d9; }
  .phys-detail-empty {
    color: #484f58;
    font-style: italic;
  }
`

// ── PhysicsDebugPane ──────────────────────────────────────────────────────────

export class PhysicsDebugPane {
  /**
   * @param {HTMLElement} container
   */
  constructor(container) {
    this._container    = container
    this._composer     = null
    this._debugRenderer = null
    this._selectedId   = null   // currently selected body id
    this._bodyEntries  = []     // [{id, type, body}] built each _renderBodyList()
    this._render()
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  /**
   * Call when a new scene is loaded to wire up the PhysicsComposer.
   * @param {import('../../physics/PhysicsComposer.js').PhysicsComposer|null} composer
   * @param {import('three').Scene} scene
   */
  attach(composer, scene) {
    this._composer = composer
    if (this._debugRenderer) this._debugRenderer.dispose()
    this._debugRenderer = composer ? new DebugRenderer(scene) : null
    this._selectedId = null
    this._renderBodyList()
    this._renderDetail(null)
    this._refreshStats()

    // Sync checkbox to current debugRenderer state (starts disabled)
    if (this._overlayCheckbox) {
      this._overlayCheckbox.checked = false
    }
  }

  /**
   * Call each frame from the animation loop (after composer.step()).
   */
  update() {
    if (this._debugRenderer && this._composer) {
      this._debugRenderer.update(this._composer)
      this._renderBodyStats()
    }
  }

  // ── Initial render (DOM skeleton) ────────────────────────────────────────────

  _render() {
    const style = document.createElement('style')
    style.textContent = PANEL_CSS
    this._container.appendChild(style)

    const root = document.createElement('div')
    root.className = 'phys-panel'
    this._container.appendChild(root)

    // Header
    const header = document.createElement('div')
    header.className = 'phys-header'

    const title = document.createElement('span')
    title.textContent = 'Physics Debug'
    header.appendChild(title)

    const toggleLabel = document.createElement('label')
    toggleLabel.className = 'phys-toggle-label'

    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.checked = false
    checkbox.addEventListener('change', () => {
      if (this._debugRenderer) {
        if (checkbox.checked) {
          this._debugRenderer.enable()
        } else {
          this._debugRenderer.disable()
        }
      }
    })
    this._overlayCheckbox = checkbox

    toggleLabel.appendChild(checkbox)
    toggleLabel.appendChild(document.createTextNode('Enable debug overlay'))
    header.appendChild(toggleLabel)
    root.appendChild(header)

    // Stats bar
    const stats = document.createElement('div')
    stats.className = 'phys-stats'

    this._statBodies   = this._makeStatCell(stats, 'Bodies',   '0')
    this._statOrbital  = this._makeStatCell(stats, 'Orbital',  '0')
    this._statRigid    = this._makeStatCell(stats, 'Rigid',    '0')
    this._statParticle = this._makeStatCell(stats, 'Particles','0')
    root.appendChild(stats)

    // Body list section
    const listHeading = document.createElement('div')
    listHeading.className = 'phys-section-heading'
    listHeading.textContent = 'Bodies'
    root.appendChild(listHeading)

    const listWrap = document.createElement('div')
    listWrap.className = 'phys-body-list'
    this._listEl = listWrap
    root.appendChild(listWrap)

    // Detail section
    const detail = document.createElement('div')
    detail.className = 'phys-detail'
    this._detailEl = detail
    root.appendChild(detail)

    this._renderBodyList()
    this._renderDetail(null)
    this._refreshStats()
  }

  // ── Body list ────────────────────────────────────────────────────────────────

  _renderBodyList() {
    this._listEl.innerHTML = ''
    this._bodyEntries = []

    if (!this._composer) {
      const empty = document.createElement('div')
      empty.className = 'empty-state'
      empty.textContent = 'No physics composer attached.'
      this._listEl.appendChild(empty)
      return
    }

    for (const world of this._composer._worlds) {
      const type = this._worldType(world)
      const col  = this._dotClass(type)
      const map  = type === 'particle' ? world._emitters : world._bodies
      if (!map) continue
      for (const [id, body] of map) {
        this._bodyEntries.push({ id, type, body })
      }
    }

    if (this._bodyEntries.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'empty-state'
      empty.textContent = 'No physics bodies in scene.'
      this._listEl.appendChild(empty)
      return
    }

    for (const entry of this._bodyEntries) {
      this._listEl.appendChild(this._buildBodyRow(entry))
    }
  }

  _buildBodyRow({ id, type, body }) {
    const row = document.createElement('div')
    row.className = 'phys-body-item' + (id === this._selectedId ? ' active' : '')
    row.dataset.bodyId = id

    const dot = document.createElement('span')
    dot.className = `phys-body-dot ${this._dotClass(type)}`
    row.appendChild(dot)

    const idEl = document.createElement('span')
    idEl.className = 'phys-body-id'
    idEl.textContent = String(id)
    row.appendChild(idEl)

    const pos = body.position
    const posEl = document.createElement('span')
    posEl.className = 'phys-body-pos'
    posEl.dataset.posEl = '1'
    if (pos) {
      posEl.textContent = this._fmtVec(pos)
    }
    row.appendChild(posEl)

    row.addEventListener('click', () => {
      this._selectedId = (this._selectedId === id) ? null : id
      this._updateActiveRow()
      this._renderDetail(this._selectedId === null ? null : { id, type, body })
    })

    return row
  }

  _updateActiveRow() {
    for (const el of this._listEl.querySelectorAll('.phys-body-item')) {
      el.classList.toggle('active', el.dataset.bodyId === String(this._selectedId))
    }
  }

  // ── Stats ────────────────────────────────────────────────────────────────────

  /**
   * Lightweight per-frame refresh: only updates position text in the body list
   * and the stats counters.  Does NOT rebuild the full DOM list.
   */
  _renderBodyStats() {
    this._refreshStats()

    // Update positions in the existing rows
    if (!this._composer) return
    let i = 0
    for (const world of this._composer._worlds) {
      const type = this._worldType(world)
      const map  = type === 'particle' ? world._emitters : world._bodies
      if (!map) continue
      for (const [id, body] of map) {
        const row = this._listEl.querySelector(`[data-body-id="${CSS.escape(String(id))}"]`)
        if (!row) continue
        const posEl = row.querySelector('[data-pos-el]')
        if (posEl && body.position) posEl.textContent = this._fmtVec(body.position)
        // Refresh selected body's detail panel live
        if (id === this._selectedId) {
          this._renderDetail({ id, type, body })
        }
        i++
      }
    }
  }

  _refreshStats() {
    if (!this._composer) {
      this._statBodies.textContent   = '0'
      this._statOrbital.textContent  = '0'
      this._statRigid.textContent    = '0'
      this._statParticle.textContent = '0'
      return
    }

    let orbital = 0, rigid = 0, particle = 0
    for (const world of this._composer._worlds) {
      const type = this._worldType(world)
      if (type === 'orbital')  orbital  += world._bodies?.size ?? 0
      if (type === 'rigid')    rigid    += world._bodies?.size ?? 0
      if (type === 'particle') particle += world._emitters?.size ?? 0
    }
    const total = orbital + rigid + particle
    this._statBodies.textContent   = String(total)
    this._statOrbital.textContent  = String(orbital)
    this._statRigid.textContent    = String(rigid)
    this._statParticle.textContent = String(particle)
  }

  // ── Detail panel ─────────────────────────────────────────────────────────────

  /**
   * @param {{id, type, body}|null} entry
   */
  _renderDetail(entry) {
    this._detailEl.innerHTML = ''

    const title = document.createElement('div')
    title.className = 'phys-detail-title'
    title.textContent = 'Body Inspector'
    this._detailEl.appendChild(title)

    if (!entry) {
      const empty = document.createElement('div')
      empty.className = 'phys-detail-empty'
      empty.textContent = 'Click a body to inspect.'
      this._detailEl.appendChild(empty)
      return
    }

    const { id, type, body } = entry

    const rows = [
      ['ID',    String(id)],
      ['Type',  type],
    ]

    if (body.position) rows.push(['Position', this._fmtVecFull(body.position)])
    if (body.velocity) rows.push(['Velocity',  this._fmtVecFull(body.velocity)])
    if (body.mass != null) rows.push(['Mass', String(body.mass)])
    if (body.desc?.shape) rows.push(['Shape', body.desc.shape.type ?? 'box'])

    // Particle emitter: show live count instead of a position
    if (type === 'particle' && body.particles != null) {
      rows.push(['Particles', String(body.particles.length)])
    }

    for (const [key, val] of rows) {
      const row = document.createElement('div')
      row.className = 'phys-detail-row'
      const k = document.createElement('span')
      k.className = 'phys-detail-key'
      k.textContent = key
      const v = document.createElement('span')
      v.className = 'phys-detail-val'
      v.textContent = val
      row.appendChild(k)
      row.appendChild(v)
      this._detailEl.appendChild(row)
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  _makeStatCell(parent, label, initial) {
    const cell = document.createElement('div')
    cell.className = 'phys-stat'

    const lbl = document.createElement('div')
    lbl.className = 'phys-stat-label'
    lbl.textContent = label
    cell.appendChild(lbl)

    const val = document.createElement('div')
    val.className = 'phys-stat-value'
    val.textContent = initial
    cell.appendChild(val)

    parent.appendChild(cell)
    return val   // return the value element so callers can update it
  }

  _worldType(world) {
    const ctor = world.constructor?.name ?? ''
    if (ctor.includes('Orbital'))  return 'orbital'
    if (ctor.includes('Rigid'))    return 'rigid'
    if (ctor.includes('Particle')) return 'particle'
    return 'unknown'
  }

  _dotClass(type) {
    if (type === 'orbital')  return 'dot-orbital'
    if (type === 'rigid')    return 'dot-rigid'
    if (type === 'particle') return 'dot-particle'
    return 'dot-orbital'
  }

  _fmtVec({ x, y, z }) {
    const fmt = v => v.toFixed(1)
    return `(${fmt(x)}, ${fmt(y)}, ${fmt(z)})`
  }

  _fmtVecFull({ x, y, z }) {
    const fmt = v => v.toFixed(3)
    return `${fmt(x)}, ${fmt(y)}, ${fmt(z)}`
  }
}
