/**
 * FileBrowser — IDE panel for browsing and managing package files.
 *
 * Shows artlab.json at the top, then *.art source files, then
 * everything inside assets/.  Supports create / rename / delete
 * of .art files via in-panel UI actions.
 */

// ── Shared dark theme helper ────────────────────────────────────────────────

const PANEL_STYLE = `
  :host { display: flex; flex-direction: column; height: 100%; }
  .artlab-panel {
    background: #1a1a2e;
    color: #c9d1d9;
    font-family: 'Consolas', 'Menlo', 'Monaco', monospace;
    font-size: 13px;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    user-select: none;
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
    gap: 6px;
  }
  .panel-body {
    flex: 1;
    overflow-y: auto;
    padding: 4px 0;
  }
  .panel-body::-webkit-scrollbar { width: 6px; }
  .panel-body::-webkit-scrollbar-track { background: transparent; }
  .panel-body::-webkit-scrollbar-thumb { background: #30363d; border-radius: 3px; }
  .section-label {
    color: #8b949e;
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 8px 10px 2px;
  }
  .file-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 10px;
    cursor: pointer;
    border-radius: 3px;
    margin: 0 4px;
    position: relative;
  }
  .file-row:hover { background: #21262d; }
  .file-row.selected { background: #1f3a5f; color: #79c0ff; }
  .file-icon { font-size: 12px; flex-shrink: 0; }
  .file-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .file-actions { display: none; gap: 3px; }
  .file-row:hover .file-actions { display: flex; }
  .file-row.selected .file-actions { display: flex; }
  .action-btn {
    background: none;
    border: none;
    color: #8b949e;
    cursor: pointer;
    font-size: 11px;
    padding: 1px 3px;
    border-radius: 2px;
    line-height: 1;
  }
  .action-btn:hover { color: #c9d1d9; background: #30363d; }
  .panel-footer {
    border-top: 1px solid #30363d;
    padding: 6px 8px;
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }
  .footer-btn {
    background: #21262d;
    border: 1px solid #30363d;
    color: #c9d1d9;
    cursor: pointer;
    font-family: inherit;
    font-size: 11px;
    padding: 3px 8px;
    border-radius: 4px;
    white-space: nowrap;
  }
  .footer-btn:hover { background: #30363d; border-color: #58a6ff; color: #58a6ff; }
  .inline-input {
    background: #0d1117;
    border: 1px solid #58a6ff;
    border-radius: 3px;
    color: #c9d1d9;
    font-family: inherit;
    font-size: 12px;
    padding: 1px 5px;
    width: 100%;
    outline: none;
  }
`

// ── File classification helpers ──────────────────────────────────────────────

/** @param {string} path */
function fileIcon(path) {
  if (path === 'artlab.json') return '⚙'
  if (path.endsWith('.art'))  return '◈'
  const ext = path.split('.').pop().toLowerCase()
  const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp']
  const audioExts = ['mp3', 'ogg', 'wav', 'flac', 'aac', 'm4a']
  const modelExts = ['glb', 'gltf', 'obj', 'fbx']
  if (imageExts.includes(ext)) return '🖼'
  if (audioExts.includes(ext)) return '♪'
  if (modelExts.includes(ext)) return '⬡'
  return '▫'
}

// ── FileBrowser ──────────────────────────────────────────────────────────────

export class FileBrowser {
  /**
   * @param {HTMLElement} container
   */
  constructor(container) {
    this._container    = container
    this._selectCb     = null
    this._selected     = null

    /** @type {Map<string, string>}  filename → content (for files loaded from a reader) */
    this._contents     = new Map()

    /** @type {string[]}  all known file paths */
    this._files        = []

    this._render()
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Populate the browser from a PackageReader instance.
   * Loads all .art files and reads their contents; records other paths.
   *
   * @param {import('../../packages/PackageReader.js').PackageReader} reader
   * @returns {Promise<void>}
   */
  async loadPackage(reader) {
    this._contents.clear()
    this._files = reader.listFiles()

    // Pre-read text files so onSelect can deliver content synchronously
    await Promise.all(
      this._files
        .filter(p => p === 'artlab.json' || p.endsWith('.art'))
        .map(async p => {
          try {
            this._contents.set(p, await reader.readFile(p))
          } catch {
            this._contents.set(p, '')
          }
        })
    )

    this._renderTree()
  }

  /**
   * Register a callback invoked when the user selects a file.
   * @param {(filename: string, content: string) => void} cb
   */
  onSelect(cb) {
    this._selectCb = cb
  }

  /**
   * Create a new empty .art file and add it to the browser.
   * @param {string} name
   */
  createFile(name) {
    if (!name.endsWith('.art')) name = name + '.art'
    if (this._files.includes(name)) return
    this._files.push(name)
    this._contents.set(name, '')
    this._renderTree()
  }

  /**
   * Rename a .art file in the browser.
   * @param {string} oldName
   * @param {string} newName
   */
  renameFile(oldName, newName) {
    if (!newName.endsWith('.art')) newName = newName + '.art'
    const idx = this._files.indexOf(oldName)
    if (idx === -1) return
    const content = this._contents.get(oldName) ?? ''
    this._files[idx] = newName
    this._contents.delete(oldName)
    this._contents.set(newName, content)
    if (this._selected === oldName) this._selected = newName
    this._renderTree()
  }

  /**
   * Remove a file from the browser.
   * @param {string} name
   */
  deleteFile(name) {
    this._files = this._files.filter(f => f !== name)
    this._contents.delete(name)
    if (this._selected === name) this._selected = null
    this._renderTree()
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  _render() {
    // Inject style once
    const style = document.createElement('style')
    style.textContent = PANEL_STYLE
    this._container.appendChild(style)

    const root = document.createElement('div')
    root.className = 'artlab-panel'
    this._container.appendChild(root)

    const header = document.createElement('div')
    header.className = 'panel-header'
    header.textContent = 'Files'
    root.appendChild(header)

    const body = document.createElement('div')
    body.className = 'panel-body'
    this._body = body
    root.appendChild(body)

    const footer = document.createElement('div')
    footer.className = 'panel-footer'
    root.appendChild(footer)

    const newBtn = document.createElement('button')
    newBtn.className = 'footer-btn'
    newBtn.textContent = '+ New File'
    newBtn.addEventListener('click', () => this._promptCreate())
    footer.appendChild(newBtn)
  }

  _renderTree() {
    this._body.innerHTML = ''
    const files = this._files

    // artlab.json first
    if (files.includes('artlab.json')) {
      this._addSection('Manifest')
      this._addRow('artlab.json', false)
    }

    // .art source files
    const artFiles = files.filter(f => f !== 'artlab.json' && f.endsWith('.art') && !f.startsWith('libs/') && !f.startsWith('assets/'))
    if (artFiles.length > 0) {
      this._addSection('Sources')
      artFiles.sort().forEach(f => this._addRow(f, true))
    }

    // Embedded libs
    const libFiles = files.filter(f => f.startsWith('libs/'))
    if (libFiles.length > 0) {
      this._addSection('Embedded Libs')
      libFiles.sort().forEach(f => this._addRow(f, false))
    }

    // Assets
    const assetFiles = files.filter(f => f.startsWith('assets/') || (!f.endsWith('.art') && !f.startsWith('libs/') && f !== 'artlab.json'))
    if (assetFiles.length > 0) {
      this._addSection('Assets')
      assetFiles.sort().forEach(f => this._addRow(f, false))
    }
  }

  /** @param {string} label */
  _addSection(label) {
    const el = document.createElement('div')
    el.className = 'section-label'
    el.textContent = label
    this._body.appendChild(el)
  }

  /**
   * @param {string}  path
   * @param {boolean} editable  - show rename/delete actions
   */
  _addRow(path, editable) {
    const row = document.createElement('div')
    row.className = 'file-row' + (this._selected === path ? ' selected' : '')
    row.dataset.path = path

    const icon = document.createElement('span')
    icon.className = 'file-icon'
    icon.textContent = fileIcon(path)
    row.appendChild(icon)

    const name = document.createElement('span')
    name.className = 'file-name'
    name.textContent = path.split('/').pop()
    name.title = path
    row.appendChild(name)

    if (editable) {
      const actions = document.createElement('span')
      actions.className = 'file-actions'

      const renameBtn = document.createElement('button')
      renameBtn.className = 'action-btn'
      renameBtn.title = 'Rename'
      renameBtn.textContent = '✎'
      renameBtn.addEventListener('click', e => { e.stopPropagation(); this._promptRename(path, row, name) })

      const deleteBtn = document.createElement('button')
      deleteBtn.className = 'action-btn'
      deleteBtn.title = 'Delete'
      deleteBtn.textContent = '✕'
      deleteBtn.addEventListener('click', e => { e.stopPropagation(); this._confirmDelete(path) })

      actions.appendChild(renameBtn)
      actions.appendChild(deleteBtn)
      row.appendChild(actions)
    }

    row.addEventListener('click', () => {
      this._selected = path
      this._renderTree()
      if (this._selectCb) {
        const content = this._contents.get(path) ?? ''
        this._selectCb(path, content)
      }
    })

    this._body.appendChild(row)
  }

  // ── Inline editing helpers ────────────────────────────────────────────────

  _promptCreate() {
    const input = document.createElement('input')
    input.className = 'inline-input'
    input.placeholder = 'filename.art'
    input.style.margin = '4px 10px'
    input.style.display = 'block'

    const commit = () => {
      const v = input.value.trim()
      this._body.removeChild(input)
      if (v) this.createFile(v)
    }
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter')  commit()
      if (e.key === 'Escape') { this._body.removeChild(input); this._renderTree() }
    })
    input.addEventListener('blur', commit)
    this._body.prepend(input)
    input.focus()
  }

  /** @param {string} path @param {HTMLElement} row @param {HTMLElement} nameEl */
  _promptRename(path, row, nameEl) {
    const input = document.createElement('input')
    input.className = 'inline-input'
    input.value = path.split('/').pop()

    const commit = () => {
      const v = input.value.trim()
      if (v && v !== path.split('/').pop()) this.renameFile(path, v)
      else this._renderTree()
    }
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter')  commit()
      if (e.key === 'Escape') this._renderTree()
    })
    input.addEventListener('blur', commit)

    nameEl.replaceWith(input)
    input.focus()
    input.select()
  }

  /** @param {string} path */
  _confirmDelete(path) {
    // Use browser confirm; a full IDE would use a modal instead
    if (window.confirm(`Delete "${path}"?`)) {
      this.deleteFile(path)
    }
  }
}
