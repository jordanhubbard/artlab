/**
 * PerformanceMonitor — IDE panel showing real-time renderer performance stats.
 *
 * Usage:
 *   const monitor = new PerformanceMonitor(containerEl, rendererInstance)
 *
 *   // Inside the animation loop, pass delta-time in seconds:
 *   monitor.update(dt)
 *
 * The renderer argument is expected to expose a nested `_renderer` property
 * that is a THREE.WebGLRenderer (WebGL2Backend pattern used in Artlab):
 *   renderer._renderer.info.render.{calls, triangles, points, lines}
 *   renderer._renderer.info.memory.{geometries, textures}
 */

// ── Styles ───────────────────────────────────────────────────────────────────

const PANEL_CSS = `
  .perf-panel {
    background: #1a1a2e;
    color: #c9d1d9;
    font-family: 'Consolas', 'Menlo', 'Monaco', monospace;
    font-size: 12px;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .perf-header {
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
    justify-content: space-between;
  }
  .perf-reset-btn {
    background: none;
    border: 1px solid #30363d;
    border-radius: 3px;
    color: #8b949e;
    cursor: pointer;
    font-family: inherit;
    font-size: 10px;
    padding: 1px 6px;
    letter-spacing: normal;
    text-transform: none;
    font-weight: normal;
  }
  .perf-reset-btn:hover { color: #c9d1d9; border-color: #8b949e; }

  .perf-body {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  .perf-body::-webkit-scrollbar { width: 6px; }
  .perf-body::-webkit-scrollbar-track { background: transparent; }
  .perf-body::-webkit-scrollbar-thumb { background: #30363d; border-radius: 3px; }

  /* FPS hero row */
  .perf-fps-hero {
    display: flex;
    align-items: baseline;
    gap: 6px;
    padding: 10px 12px 4px;
    border-bottom: 1px solid #30363d;
    flex-shrink: 0;
  }
  .perf-fps-value {
    color: #3fb950;
    font-size: 28px;
    font-weight: 700;
    line-height: 1;
    min-width: 52px;
    text-align: right;
  }
  .perf-fps-value.warn  { color: #e3b341; }
  .perf-fps-value.crit  { color: #f85149; }
  .perf-fps-unit {
    color: #8b949e;
    font-size: 12px;
  }
  .perf-fps-avg {
    color: #484f58;
    font-size: 11px;
    margin-left: auto;
  }

  /* Sparkline canvas row */
  .perf-spark-wrap {
    padding: 6px 10px 4px;
    border-bottom: 1px solid #30363d;
    flex-shrink: 0;
  }
  .perf-spark-label {
    color: #484f58;
    font-size: 9px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    margin-bottom: 3px;
  }
  .perf-spark-canvas {
    display: block;
    width: 100%;
    height: 40px;
    border-radius: 3px;
    background: #0d1117;
  }

  /* Stats grid */
  .perf-section-heading {
    color: #484f58;
    font-size: 9px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 8px 12px 4px;
    flex-shrink: 0;
  }
  .perf-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1px;
    background: #30363d;
    border-top: 1px solid #30363d;
    flex-shrink: 0;
  }
  .perf-cell {
    background: #1a1a2e;
    padding: 6px 10px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .perf-cell-label {
    color: #484f58;
    font-size: 9px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .perf-cell-value {
    color: #79c0ff;
    font-size: 14px;
    font-weight: 600;
  }

  /* Frame time section */
  .perf-frametime-row {
    display: flex;
    align-items: baseline;
    gap: 6px;
    padding: 6px 12px;
    border-bottom: 1px solid #30363d;
    flex-shrink: 0;
  }
  .perf-frametime-label {
    color: #484f58;
    font-size: 10px;
    min-width: 90px;
  }
  .perf-frametime-value { color: #c9d1d9; font-size: 11px; }
`

// ── PerformanceMonitor ────────────────────────────────────────────────────────

export class PerformanceMonitor {
  /**
   * @param {HTMLElement} container
   * @param {object} renderer  - IRenderer wrapping a THREE.WebGLRenderer at ._renderer
   */
  constructor(container, renderer) {
    this._container  = container
    this._renderer   = renderer
    this._samples    = []          // FPS history (up to _maxSamples entries)
    this._maxSamples = 60
    this._minFps     = Infinity
    this._maxFps     = 0
    this._render()
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  /**
   * Call each frame.  dt is delta-time in seconds.
   * @param {number} dt
   */
  update(dt) {
    if (!dt || dt <= 0) return
    const fps = 1 / dt
    this._samples.push(fps)
    if (this._samples.length > this._maxSamples) this._samples.shift()
    if (fps < this._minFps) this._minFps = fps
    if (fps > this._maxFps) this._maxFps = fps
    this._refresh()
  }

  // ── Initial DOM skeleton ─────────────────────────────────────────────────────

  _render() {
    const style = document.createElement('style')
    style.textContent = PANEL_CSS
    this._container.appendChild(style)

    const root = document.createElement('div')
    root.className = 'perf-panel'
    this._container.appendChild(root)

    // Header
    const header = document.createElement('div')
    header.className = 'perf-header'
    const title = document.createElement('span')
    title.textContent = 'Performance'
    header.appendChild(title)

    const resetBtn = document.createElement('button')
    resetBtn.className = 'perf-reset-btn'
    resetBtn.textContent = 'Reset'
    resetBtn.title = 'Clear sample history and min/max'
    resetBtn.addEventListener('click', () => {
      this._samples = []
      this._minFps = Infinity
      this._maxFps = 0
      this._refresh()
    })
    header.appendChild(resetBtn)
    root.appendChild(header)

    const body = document.createElement('div')
    body.className = 'perf-body'
    root.appendChild(body)

    // FPS hero row
    const fpsHero = document.createElement('div')
    fpsHero.className = 'perf-fps-hero'

    const fpsValue = document.createElement('span')
    fpsValue.className = 'perf-fps-value'
    fpsValue.textContent = '--'
    this._fpsValueEl = fpsValue
    fpsHero.appendChild(fpsValue)

    const fpsUnit = document.createElement('span')
    fpsUnit.className = 'perf-fps-unit'
    fpsUnit.textContent = 'fps'
    fpsHero.appendChild(fpsUnit)

    const fpsAvg = document.createElement('span')
    fpsAvg.className = 'perf-fps-avg'
    fpsAvg.textContent = 'avg --'
    this._fpsAvgEl = fpsAvg
    fpsHero.appendChild(fpsAvg)
    body.appendChild(fpsHero)

    // Frame-time rows
    const ftRow = (label) => {
      const row = document.createElement('div')
      row.className = 'perf-frametime-row'
      const lbl = document.createElement('span')
      lbl.className = 'perf-frametime-label'
      lbl.textContent = label
      const val = document.createElement('span')
      val.className = 'perf-frametime-value'
      val.textContent = '--'
      row.appendChild(lbl)
      row.appendChild(val)
      body.appendChild(row)
      return val
    }

    this._ftCurEl  = ftRow('Frame time (cur)')
    this._ftMinEl  = ftRow('FPS min')
    this._ftMaxEl  = ftRow('FPS max')

    // Sparkline
    const sparkWrap = document.createElement('div')
    sparkWrap.className = 'perf-spark-wrap'
    const sparkLabel = document.createElement('div')
    sparkLabel.className = 'perf-spark-label'
    sparkLabel.textContent = 'FPS history (last 60 frames)'
    sparkWrap.appendChild(sparkLabel)

    const canvas = document.createElement('canvas')
    canvas.className = 'perf-spark-canvas'
    canvas.width  = 200
    canvas.height = 40
    this._canvas = canvas
    sparkWrap.appendChild(canvas)
    body.appendChild(sparkWrap)

    // Renderer stats section
    const rdLabel = document.createElement('div')
    rdLabel.className = 'perf-section-heading'
    rdLabel.textContent = 'Renderer'
    body.appendChild(rdLabel)

    const grid = document.createElement('div')
    grid.className = 'perf-grid'
    body.appendChild(grid)

    this._drawCallsEl  = this._makeCell(grid, 'Draw Calls',  '--')
    this._trianglesEl  = this._makeCell(grid, 'Triangles',   '--')
    this._geometriesEl = this._makeCell(grid, 'Geometries',  '--')
    this._texturesEl   = this._makeCell(grid, 'Textures',    '--')

    this._refresh()
  }

  // ── Per-frame refresh ────────────────────────────────────────────────────────

  _refresh() {
    const n = this._samples.length
    const curFps = n > 0 ? this._samples[n - 1] : null
    const avgFps = n > 0 ? this._samples.reduce((a, b) => a + b, 0) / n : null

    // FPS hero
    if (curFps != null) {
      const rounded = Math.round(curFps)
      this._fpsValueEl.textContent = String(rounded)
      this._fpsValueEl.className = 'perf-fps-value' +
        (rounded < 20 ? ' crit' : rounded < 45 ? ' warn' : '')
    } else {
      this._fpsValueEl.textContent = '--'
      this._fpsValueEl.className = 'perf-fps-value'
    }

    this._fpsAvgEl.textContent = avgFps != null
      ? `avg ${avgFps.toFixed(1)}`
      : 'avg --'

    // Frame-time extras
    const ftMs = curFps != null ? (1000 / curFps).toFixed(2) + ' ms' : '--'
    this._ftCurEl.textContent = ftMs

    this._ftMinEl.textContent = isFinite(this._minFps)
      ? Math.round(this._minFps) + ' fps'
      : '--'
    this._ftMaxEl.textContent = this._maxFps > 0
      ? Math.round(this._maxFps) + ' fps'
      : '--'

    // Sparkline
    this._drawSparkline()

    // Renderer info
    const info = this._getRendererInfo()
    this._drawCallsEl.textContent  = info ? this._fmtNum(info.render.calls)     : '--'
    this._trianglesEl.textContent  = info ? this._fmtNum(info.render.triangles) : '--'
    this._geometriesEl.textContent = info ? this._fmtNum(info.memory.geometries): '--'
    this._texturesEl.textContent   = info ? this._fmtNum(info.memory.textures)  : '--'
  }

  // ── Sparkline ────────────────────────────────────────────────────────────────

  _drawSparkline() {
    const canvas = this._canvas
    const ctx    = canvas.getContext('2d')
    const W = canvas.width
    const H = canvas.height

    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = '#0d1117'
    ctx.fillRect(0, 0, W, H)

    const n = this._samples.length
    if (n < 2) return

    // Reference lines at 30 and 60 fps
    const fpsToY = (fps) => {
      const clipped = Math.max(0, Math.min(fps, 120))
      return H - (clipped / 120) * H
    }

    ctx.strokeStyle = '#21262d'
    ctx.lineWidth = 1
    for (const ref of [30, 60]) {
      const y = Math.round(fpsToY(ref)) + 0.5
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(W, y)
      ctx.stroke()
    }

    // Determine x step
    const step = W / (this._maxSamples - 1)

    // Fill area
    const startIdx = Math.max(0, this._maxSamples - n)

    ctx.beginPath()
    for (let i = 0; i < n; i++) {
      const x = (startIdx + i) * step
      const y = fpsToY(this._samples[i])
      if (i === 0) ctx.moveTo(x, y)
      else         ctx.lineTo(x, y)
    }
    // Close fill to bottom
    const lastX = (startIdx + n - 1) * step
    ctx.lineTo(lastX, H)
    ctx.lineTo(startIdx * step, H)
    ctx.closePath()
    ctx.fillStyle = 'rgba(63,185,80,0.15)'
    ctx.fill()

    // Stroke line — colour shifts based on current fps
    const cur = this._samples[n - 1]
    const lineColor = cur < 20 ? '#f85149' : cur < 45 ? '#e3b341' : '#3fb950'

    ctx.beginPath()
    for (let i = 0; i < n; i++) {
      const x = (startIdx + i) * step
      const y = fpsToY(this._samples[i])
      if (i === 0) ctx.moveTo(x, y)
      else         ctx.lineTo(x, y)
    }
    ctx.strokeStyle = lineColor
    ctx.lineWidth   = 1.5
    ctx.stroke()

    // Dot at tip
    const tipX = (startIdx + n - 1) * step
    const tipY = fpsToY(cur)
    ctx.beginPath()
    ctx.arc(tipX, tipY, 2.5, 0, Math.PI * 2)
    ctx.fillStyle = lineColor
    ctx.fill()
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  _getRendererInfo() {
    try {
      return this._renderer?._renderer?.info ?? null
    } catch {
      return null
    }
  }

  _makeCell(parent, label, initial) {
    const cell = document.createElement('div')
    cell.className = 'perf-cell'

    const lbl = document.createElement('div')
    lbl.className = 'perf-cell-label'
    lbl.textContent = label
    cell.appendChild(lbl)

    const val = document.createElement('div')
    val.className = 'perf-cell-value'
    val.textContent = initial
    cell.appendChild(val)

    parent.appendChild(cell)
    return val   // return value element so caller can update
  }

  _fmtNum(n) {
    if (n == null) return '--'
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M'
    if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K'
    return String(n)
  }
}
