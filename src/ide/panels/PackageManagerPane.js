/**
 * PackageManagerPane — IDE panel for managing URL dependencies declared in
 * artlab.json and static-linking them into a self-contained zip.
 *
 * Workflow:
 *  1. loadManifest(manifest)  — populate the dep list from artlab.json
 *  2. addDep / removeDep      — mutate the in-memory manifest copy
 *  3. staticLink(reader)      — run StaticLinker and trigger a download
 */

import { StaticLinker } from '../../packages/StaticLinker.js'
import { DevResolver   } from '../../packages/DevResolver.js'

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
  }
  .panel-body {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .panel-body::-webkit-scrollbar { width: 6px; }
  .panel-body::-webkit-scrollbar-track { background: transparent; }
  .panel-body::-webkit-scrollbar-thumb { background: #30363d; border-radius: 3px; }
  .section-label {
    color: #8b949e;
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 4px 0 2px;
  }
  .dep-row {
    background: #21262d;
    border: 1px solid #30363d;
    border-radius: 4px;
    padding: 6px 8px;
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }
  .dep-info { flex: 1; overflow: hidden; }
  .dep-name {
    color: #79c0ff;
    font-weight: 600;
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .dep-url {
    color: #8b949e;
    font-size: 10px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .dep-remove {
    background: none;
    border: 1px solid #30363d;
    border-radius: 3px;
    color: #8b949e;
    cursor: pointer;
    font-size: 11px;
    padding: 1px 5px;
    flex-shrink: 0;
    align-self: center;
    font-family: inherit;
  }
  .dep-remove:hover { color: #f85149; border-color: #f85149; }
  .empty-state {
    color: #484f58;
    font-style: italic;
    text-align: center;
    padding: 12px 0;
  }
  /* Add dep form */
  .add-form {
    background: #21262d;
    border: 1px solid #30363d;
    border-radius: 4px;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .form-label {
    color: #8b949e;
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .form-input {
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 3px;
    color: #c9d1d9;
    font-family: inherit;
    font-size: 12px;
    padding: 4px 7px;
    outline: none;
    width: 100%;
    box-sizing: border-box;
  }
  .form-input:focus { border-color: #58a6ff; }
  .form-row { display: flex; gap: 5px; }
  .form-btn {
    background: #21262d;
    border: 1px solid #30363d;
    border-radius: 4px;
    color: #c9d1d9;
    cursor: pointer;
    font-family: inherit;
    font-size: 11px;
    padding: 4px 10px;
    white-space: nowrap;
  }
  .form-btn:hover { background: #30363d; }
  .form-btn.primary { background: #1f3a5f; border-color: #58a6ff; color: #58a6ff; }
  .form-btn.primary:hover { background: #1a4a7a; }
  .form-btn.danger { border-color: #da3633; color: #f85149; }
  .form-btn.danger:hover { background: #3d1010; }
  /* static-link section */
  .link-section {
    border-top: 1px solid #30363d;
    padding: 8px 0 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex-shrink: 0;
  }
  .link-btn {
    background: #1e3020;
    border: 1px solid #3fb950;
    border-radius: 4px;
    color: #3fb950;
    cursor: pointer;
    font-family: inherit;
    font-size: 12px;
    font-weight: 600;
    padding: 6px 12px;
    width: 100%;
    text-align: center;
  }
  .link-btn:hover { background: #243a26; }
  .link-btn:disabled { opacity: 0.45; cursor: not-allowed; }
  .link-progress {
    color: #58a6ff;
    font-size: 11px;
    text-align: center;
    min-height: 16px;
  }
  .link-error { color: #f85149; font-size: 11px; }
`

// ── PackageManagerPane ───────────────────────────────────────────────────────

export class PackageManagerPane {
  /**
   * @param {HTMLElement} container
   */
  constructor(container) {
    this._container = container

    /** @type {Object|null}  current in-memory copy of the manifest */
    this._manifest = null

    this._render()
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Populate the dep list from an artlab.json manifest object.
   * @param {import('../../packages/Manifest.js').ArtlabManifest} manifest
   */
  loadManifest(manifest) {
    // Deep-copy so mutations don't affect caller's object
    this._manifest = JSON.parse(JSON.stringify(manifest))
    this._renderDeps()
  }

  /**
   * Add a URL dependency to the in-memory manifest.
   * @param {string} name  - identifier (e.g. "artlab/geometry")
   * @param {string} url   - URL to the .art source
   */
  addDep(name, url) {
    if (!this._manifest) return
    if (!this._manifest.dependencies) this._manifest.dependencies = {}
    this._manifest.dependencies[name] = url
    this._renderDeps()
  }

  /**
   * Remove a dependency from the in-memory manifest.
   * @param {string} name
   */
  removeDep(name) {
    if (!this._manifest?.dependencies) return
    delete this._manifest.dependencies[name]
    this._renderDeps()
  }

  /**
   * Run StaticLinker on the provided reader + current manifest and download
   * the resulting self-contained zip.
   *
   * @param {import('../../packages/PackageReader.js').PackageReader} reader
   * @returns {Promise<void>}
   */
  async staticLink(reader) {
    if (!this._manifest) {
      this._setProgress('No manifest loaded.', true)
      return
    }

    this._linkBtn.disabled = true
    this._setProgress('Resolving dependencies…')

    const resolver = new DevResolver()
    const linker   = new StaticLinker(reader, resolver)

    try {
      const writer = await linker.link(({ fetched, total, current }) => {
        const basename = current.split('/').pop()
        this._setProgress(`Fetching ${fetched}/${total}: ${basename}`)
      })

      this._setProgress('Building zip…')
      const pkgName = (this._manifest.name || 'package').replace(/[^a-zA-Z0-9._-]/g, '_')
      await writer.download(`${pkgName}.artlab`)
      this._setProgress(`Done — ${pkgName}.artlab downloaded.`)
    } catch (err) {
      this._setProgress(`Static link failed: ${err.message}`, true)
    } finally {
      this._linkBtn.disabled = false
    }
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
    header.textContent = 'Package Manager'
    root.appendChild(header)

    const body = document.createElement('div')
    body.className = 'panel-body'
    this._body = body
    root.appendChild(body)

    // --- Add-dep form -------------------------------------------------------
    const formSection = document.createElement('div')
    formSection.className = 'add-form'

    const formTitle = document.createElement('div')
    formTitle.className = 'form-label'
    formTitle.textContent = 'Add Dependency'
    formSection.appendChild(formTitle)

    const nameInput = document.createElement('input')
    nameInput.className = 'form-input'
    nameInput.placeholder = 'Name  (e.g. artlab/geometry)'
    nameInput.type = 'text'
    formSection.appendChild(nameInput)
    this._nameInput = nameInput

    const urlInput = document.createElement('input')
    urlInput.className = 'form-input'
    urlInput.placeholder = 'URL  (https://…/geometry.art)'
    urlInput.type = 'url'
    formSection.appendChild(urlInput)
    this._urlInput = urlInput

    const addBtn = document.createElement('button')
    addBtn.className = 'form-btn primary'
    addBtn.textContent = '+ Add'
    addBtn.addEventListener('click', () => {
      const name = nameInput.value.trim()
      const url  = urlInput.value.trim()
      if (!name || !url) return
      this.addDep(name, url)
      nameInput.value = ''
      urlInput.value  = ''
    })

    // Allow Enter in url field to submit
    urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') addBtn.click() })
    nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') urlInput.focus() })

    formSection.appendChild(addBtn)
    body.appendChild(formSection)

    // --- Dep list placeholder -----------------------------------------------
    const depSection = document.createElement('div')
    this._depSection = depSection
    body.appendChild(depSection)

    // --- Static link section ------------------------------------------------
    const linkSection = document.createElement('div')
    linkSection.className = 'link-section'

    const linkBtn = document.createElement('button')
    linkBtn.className = 'link-btn'
    linkBtn.textContent = 'Static Link & Download'
    linkBtn.addEventListener('click', async () => {
      if (!this._reader) {
        this._setProgress('Call staticLink(reader) or load a package first.', true)
        return
      }
      await this.staticLink(this._reader)
    })
    this._linkBtn = linkBtn
    linkSection.appendChild(linkBtn)

    const progress = document.createElement('div')
    progress.className = 'link-progress'
    this._progressEl = progress
    linkSection.appendChild(progress)

    body.appendChild(linkSection)

    this._renderDeps()
  }

  /**
   * Store the reader so the link button can use it without an explicit call.
   * PackageManagerPane.staticLink(reader) also accepts it directly.
   * @param {import('../../packages/PackageReader.js').PackageReader} reader
   */
  setReader(reader) {
    this._reader = reader
  }

  _renderDeps() {
    this._depSection.innerHTML = ''

    const deps   = this._manifest?.dependencies || {}
    const entries = Object.entries(deps)

    const label = document.createElement('div')
    label.className = 'section-label'
    label.textContent = `Dependencies (${entries.length})`
    this._depSection.appendChild(label)

    if (entries.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'empty-state'
      empty.textContent = 'No dependencies declared.'
      this._depSection.appendChild(empty)
      return
    }

    for (const [name, url] of entries.sort((a, b) => a[0].localeCompare(b[0]))) {
      this._depSection.appendChild(this._buildDepRow(name, url))
    }
  }

  /**
   * @param {string} name
   * @param {string} url
   */
  _buildDepRow(name, url) {
    const row = document.createElement('div')
    row.className = 'dep-row'

    const info = document.createElement('div')
    info.className = 'dep-info'

    const nameEl = document.createElement('div')
    nameEl.className = 'dep-name'
    nameEl.textContent = name
    nameEl.title = name
    info.appendChild(nameEl)

    const urlEl = document.createElement('div')
    urlEl.className = 'dep-url'
    urlEl.textContent = url
    urlEl.title = url
    info.appendChild(urlEl)

    row.appendChild(info)

    const removeBtn = document.createElement('button')
    removeBtn.className = 'dep-remove'
    removeBtn.title = `Remove "${name}"`
    removeBtn.textContent = '✕'
    removeBtn.addEventListener('click', () => this.removeDep(name))
    row.appendChild(removeBtn)

    return row
  }

  /**
   * @param {string}  text
   * @param {boolean} [isError]
   */
  _setProgress(text, isError = false) {
    this._progressEl.className = 'link-progress' + (isError ? ' link-error' : '')
    this._progressEl.textContent = text
  }
}
