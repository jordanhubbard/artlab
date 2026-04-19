/**
 * ErrorConsole — IDE panel displaying DSL compile errors/warnings and
 * runtime log output.
 *
 * Compile errors are rendered with the same source-snippet + caret format
 * produced by ErrorReporter.  Runtime logs show a timestamp, coloured level
 * badge, and message.
 */

import { ErrorReporter } from '../../dsl/ErrorReporter.js'

// ── Shared constants ────────────────────────────────────────────────────────

const LEVEL_STYLES = {
  info:  { badge: 'INFO',  color: '#58a6ff', bg: '#1f3a5f' },
  warn:  { badge: 'WARN',  color: '#e3b341', bg: '#3d2f00' },
  error: { badge: 'ERROR', color: '#f85149', bg: '#3d1010' },
}

const PANEL_CSS = `
  .artlab-panel {
    background: #1a1a2e;
    color: #c9d1d9;
    font-family: 'Consolas', 'Menlo', 'Monaco', monospace;
    font-size: 12px;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .panel-header {
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
  .clear-btn {
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
  }
  .clear-btn:hover { color: #c9d1d9; border-color: #8b949e; }
  .panel-body {
    flex: 1;
    overflow-y: auto;
    padding: 4px 0;
  }
  .panel-body::-webkit-scrollbar { width: 6px; }
  .panel-body::-webkit-scrollbar-track { background: transparent; }
  .panel-body::-webkit-scrollbar-thumb { background: #30363d; border-radius: 3px; }
  .empty-state {
    color: #484f58;
    padding: 20px 14px;
    text-align: center;
    font-style: italic;
  }
  /* ── Compile error block ── */
  .err-block {
    border-left: 3px solid;
    margin: 4px 8px;
    border-radius: 0 3px 3px 0;
    overflow: hidden;
  }
  .err-block.level-error { border-color: #f85149; background: #1c0f0f; }
  .err-block.level-warning { border-color: #e3b341; background: #1c1800; }
  .err-heading {
    padding: 4px 8px 2px;
    font-weight: 600;
    display: flex;
    gap: 8px;
    align-items: baseline;
  }
  .err-label-error  { color: #f85149; }
  .err-label-warning { color: #e3b341; }
  .err-msg { color: #e6edf3; }
  .err-location { color: #8b949e; font-size: 11px; }
  .err-snippet {
    padding: 4px 8px 6px;
    overflow-x: auto;
    color: #8b949e;
    white-space: pre;
    font-size: 11px;
    line-height: 1.5;
  }
  .err-snippet .snip-cur-line { color: #e6edf3; }
  .err-snippet .snip-caret    { color: #f85149; }
  /* ── Runtime log entry ── */
  .log-entry {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 3px 10px;
    border-bottom: 1px solid #21262d;
    line-height: 1.45;
  }
  .log-ts {
    color: #484f58;
    font-size: 10px;
    flex-shrink: 0;
    white-space: nowrap;
  }
  .log-badge {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.05em;
    padding: 0 4px;
    border-radius: 2px;
    flex-shrink: 0;
  }
  .log-msg { color: #c9d1d9; word-break: break-word; }
`

// ── ErrorConsole ─────────────────────────────────────────────────────────────

export class ErrorConsole {
  /**
   * @param {HTMLElement} container
   */
  constructor(container) {
    this._container = container
    this._reporter  = new ErrorReporter()
    this._render()
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Display DSL compile errors and/or warnings.
   * Each item: { message, line?, col?, severity?, source? }
   *
   * @param {Array<{message: string, line?: number, col?: number, source?: string}>} errors
   * @param {Array<{message: string, line?: number, col?: number, source?: string}>} [warnings]
   */
  showErrors(errors, warnings = []) {
    const all = [
      ...errors.map(e => ({ ...e, severity: 'error' })),
      ...warnings.map(w => ({ ...w, severity: 'warning' })),
    ]
    if (all.length === 0) return

    this._hideEmpty()
    for (const item of all) {
      this._body.appendChild(this._buildErrBlock(item))
    }
    this._scrollBottom()
  }

  /**
   * Append a runtime log entry.
   * @param {'info'|'warn'|'error'} level
   * @param {string} message
   */
  log(level, message) {
    if (!LEVEL_STYLES[level]) level = 'info'
    this._hideEmpty()
    this._body.appendChild(this._buildLogEntry(level, message))
    this._scrollBottom()
  }

  /**
   * Remove all messages.
   */
  clear() {
    this._body.innerHTML = ''
    this._body.appendChild(this._emptyState())
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  _render() {
    const style = document.createElement('style')
    style.textContent = PANEL_CSS
    this._container.appendChild(style)

    const root = document.createElement('div')
    root.className = 'artlab-panel'
    this._container.appendChild(root)

    const header = document.createElement('div')
    header.className = 'panel-header'

    const title = document.createElement('span')
    title.textContent = 'Console'
    header.appendChild(title)

    const clearBtn = document.createElement('button')
    clearBtn.className = 'clear-btn'
    clearBtn.textContent = 'Clear'
    clearBtn.addEventListener('click', () => this.clear())
    header.appendChild(clearBtn)

    root.appendChild(header)

    const body = document.createElement('div')
    body.className = 'panel-body'
    this._body = body
    root.appendChild(body)

    body.appendChild(this._emptyState())
  }

  _emptyState() {
    const el = document.createElement('div')
    el.className = 'empty-state'
    el.dataset.emptyState = '1'
    el.textContent = 'No errors or warnings.'
    return el
  }

  _hideEmpty() {
    const el = this._body.querySelector('[data-empty-state]')
    if (el) el.remove()
  }

  /**
   * Build a coloured compile-error block with source snippet.
   * @param {{message: string, line?: number, col?: number, severity?: string, source?: string}} item
   */
  _buildErrBlock(item) {
    const isError  = item.severity !== 'warning'
    const levelKey = isError ? 'level-error' : 'level-warning'

    const block = document.createElement('div')
    block.className = `err-block ${levelKey}`

    // Heading row
    const heading = document.createElement('div')
    heading.className = 'err-heading'

    const label = document.createElement('span')
    label.className = isError ? 'err-label-error' : 'err-label-warning'
    label.textContent = isError ? 'error' : 'warning'
    heading.appendChild(label)

    const msg = document.createElement('span')
    msg.className = 'err-msg'
    msg.textContent = item.message
    heading.appendChild(msg)

    if (item.line) {
      const loc = document.createElement('span')
      loc.className = 'err-location'
      loc.textContent = `line ${item.line}` + (item.col ? `, col ${item.col}` : '')
      heading.appendChild(loc)
    }

    block.appendChild(heading)

    // Source snippet
    if (item.source && item.line) {
      const srcLines = item.source.split('\n')
      const idx      = item.line - 1
      const snippet  = document.createElement('div')
      snippet.className = 'err-snippet'

      const lineNo   = item.line
      const colNo    = item.col || 1
      const numW     = String(lineNo + 1).length

      const lines = []

      if (idx > 0) {
        lines.push(`${String(lineNo - 1).padStart(numW)} | ${srcLines[idx - 1] || ''}`)
      }

      lines.push(`\x00cur\x00${String(lineNo).padStart(numW)} | ${srcLines[idx] || ''}`)
      lines.push(`${' '.repeat(numW + 3)}${' '.repeat(Math.max(0, colNo - 1))}\x00caret\x00^`)

      if (idx < srcLines.length - 1) {
        lines.push(`${String(lineNo + 1).padStart(numW)} | ${srcLines[idx + 1] || ''}`)
      }

      // Render each line, applying span highlights for current line and caret
      for (const raw of lines) {
        if (raw.startsWith('\x00cur\x00')) {
          const span = document.createElement('span')
          span.className = 'snip-cur-line'
          span.textContent = raw.slice(5) + '\n'
          snippet.appendChild(span)
        } else if (raw.includes('\x00caret\x00')) {
          const span = document.createElement('span')
          span.className = 'snip-caret'
          span.textContent = raw.replace('\x00caret\x00', '') + '\n'
          snippet.appendChild(span)
        } else {
          snippet.appendChild(document.createTextNode(raw + '\n'))
        }
      }

      block.appendChild(snippet)
    }

    return block
  }

  /**
   * Build a runtime log row.
   * @param {'info'|'warn'|'error'} level
   * @param {string} message
   */
  _buildLogEntry(level, message) {
    const s = LEVEL_STYLES[level]

    const entry = document.createElement('div')
    entry.className = 'log-entry'

    const ts = document.createElement('span')
    ts.className = 'log-ts'
    ts.textContent = new Date().toISOString().slice(11, 23)  // HH:MM:SS.mmm
    entry.appendChild(ts)

    const badge = document.createElement('span')
    badge.className = 'log-badge'
    badge.style.color      = s.color
    badge.style.background = s.bg
    badge.textContent      = s.badge
    entry.appendChild(badge)

    const msg = document.createElement('span')
    msg.className = 'log-msg'
    msg.textContent = message
    entry.appendChild(msg)

    return entry
  }

  _scrollBottom() {
    this._body.scrollTop = this._body.scrollHeight
  }
}
