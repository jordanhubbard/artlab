/**
 * AssetBrowser — IDE panel for previewing in-package assets.
 *
 * Image files → thumbnail (max 80px, clicking opens full-size in a new tab).
 * Audio files → waveform icon + inline <audio> play button.
 * 3D model files (.glb, .obj, .fbx) → 3D icon badge.
 * Other binary assets → generic file badge.
 */

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif'])
const AUDIO_EXTS = new Set(['mp3', 'ogg', 'wav', 'flac', 'aac', 'm4a', 'opus'])
const MODEL_EXTS = new Set(['glb', 'gltf', 'obj', 'fbx'])

function ext(path) {
  return path.split('.').pop().toLowerCase()
}

function basename(path) {
  return path.split('/').pop()
}

/** Derive a MIME type for audio blobs so <audio> can decode them. */
function audioMime(path) {
  const map = { mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', flac: 'audio/flac', aac: 'audio/aac', m4a: 'audio/mp4', opus: 'audio/ogg; codecs=opus' }
  return map[ext(path)] || 'audio/octet-stream'
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
  }
  .panel-body {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .panel-body::-webkit-scrollbar { width: 6px; }
  .panel-body::-webkit-scrollbar-track { background: transparent; }
  .panel-body::-webkit-scrollbar-thumb { background: #30363d; border-radius: 3px; }
  .empty-state {
    color: #484f58;
    padding: 20px 0;
    text-align: center;
    font-style: italic;
  }
  .asset-card {
    background: #21262d;
    border: 1px solid #30363d;
    border-radius: 5px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .asset-preview {
    background: #0d1117;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 64px;
    padding: 8px;
    position: relative;
  }
  .asset-preview img {
    max-width: 100%;
    max-height: 140px;
    object-fit: contain;
    cursor: pointer;
    border-radius: 3px;
    display: block;
  }
  .asset-preview img:hover { opacity: 0.85; }
  .asset-icon {
    font-size: 36px;
    line-height: 1;
    text-align: center;
  }
  .asset-footer {
    padding: 5px 8px;
    border-top: 1px solid #30363d;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .asset-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 11px;
    color: #8b949e;
  }
  .asset-name:hover { color: #c9d1d9; }
  .asset-type-badge {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 1px 5px;
    border-radius: 3px;
    flex-shrink: 0;
    background: #30363d;
    color: #8b949e;
  }
  .badge-image { background: #1f3a5f; color: #58a6ff; }
  .badge-audio { background: #1e3020; color: #3fb950; }
  .badge-model { background: #2d1f4e; color: #bc8cff; }
  /* inline audio player */
  .audio-player {
    width: 100%;
    height: 28px;
    accent-color: #3fb950;
    margin-top: 4px;
  }
  /* loading / error state */
  .asset-loading { color: #484f58; font-size: 11px; font-style: italic; }
  .asset-error   { color: #f85149; font-size: 11px; }
`

export class AssetBrowser {
  /**
   * @param {HTMLElement} container
   */
  constructor(container) {
    this._container = container
    this._objectUrls = []   // revoke on next load
    this._render()
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Load assets from a PackageReader and populate the panel.
   * Shows images as thumbnails, audio with a play button, 3D models with an icon.
   *
   * @param {import('../../packages/PackageReader.js').PackageReader} reader
   * @returns {Promise<void>}
   */
  async loadPackage(reader) {
    // Release any previously created object URLs
    for (const url of this._objectUrls) URL.revokeObjectURL(url)
    this._objectUrls = []

    this._body.innerHTML = ''

    const allFiles  = reader.listFiles()
    const assetPaths = allFiles.filter(p => {
      const e = ext(p)
      return IMAGE_EXTS.has(e) || AUDIO_EXTS.has(e) || MODEL_EXTS.has(e)
    })

    if (assetPaths.length === 0) {
      this._body.appendChild(this._emptyState('No assets found in package.'))
      return
    }

    // Load all assets concurrently; render a placeholder card per asset first
    // then fill in the preview asynchronously.
    for (const path of assetPaths.sort()) {
      const card = this._buildPlaceholderCard(path)
      this._body.appendChild(card)
    }

    // Now load blobs and fill previews
    await Promise.all(assetPaths.sort().map(async (path, i) => {
      const card = this._body.children[i]
      try {
        const blob = await reader.readAsset(path)
        await this._fillPreview(card, path, blob)
      } catch (err) {
        const preview = card.querySelector('.asset-preview')
        if (preview) {
          preview.innerHTML = ''
          const errEl = document.createElement('span')
          errEl.className = 'asset-error'
          errEl.textContent = 'Failed to load'
          preview.appendChild(errEl)
        }
      }
    }))
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
    header.textContent = 'Assets'
    root.appendChild(header)

    const body = document.createElement('div')
    body.className = 'panel-body'
    this._body = body
    root.appendChild(body)

    body.appendChild(this._emptyState('No package loaded.'))
  }

  _emptyState(text = 'No assets found.') {
    const el = document.createElement('div')
    el.className = 'empty-state'
    el.textContent = text
    return el
  }

  /**
   * Build a card shell with a loading indicator while the blob is fetched.
   * @param {string} path
   * @returns {HTMLElement}
   */
  _buildPlaceholderCard(path) {
    const e     = ext(path)
    const isImg = IMAGE_EXTS.has(e)
    const isAud = AUDIO_EXTS.has(e)
    const isMod = MODEL_EXTS.has(e)

    const card = document.createElement('div')
    card.className = 'asset-card'

    const preview = document.createElement('div')
    preview.className = 'asset-preview'
    const loading = document.createElement('span')
    loading.className = 'asset-loading'
    loading.textContent = 'Loading…'
    preview.appendChild(loading)
    card.appendChild(preview)

    const footer = document.createElement('div')
    footer.className = 'asset-footer'

    const name = document.createElement('span')
    name.className = 'asset-name'
    name.textContent = basename(path)
    name.title = path
    footer.appendChild(name)

    const badge = document.createElement('span')
    badge.className = 'asset-type-badge'
    if (isImg) { badge.classList.add('badge-image'); badge.textContent = 'Image' }
    else if (isAud) { badge.classList.add('badge-audio'); badge.textContent = 'Audio' }
    else if (isMod) { badge.classList.add('badge-model'); badge.textContent = '3D' }
    footer.appendChild(badge)

    card.appendChild(footer)
    return card
  }

  /**
   * Fill the preview area of a card once the blob is available.
   * @param {HTMLElement} card
   * @param {string}      path
   * @param {Blob}        blob
   */
  async _fillPreview(card, path, blob) {
    const preview = card.querySelector('.asset-preview')
    preview.innerHTML = ''

    const e     = ext(path)
    const isImg = IMAGE_EXTS.has(e)
    const isAud = AUDIO_EXTS.has(e)

    if (isImg) {
      const url = URL.createObjectURL(blob)
      this._objectUrls.push(url)

      const img = document.createElement('img')
      img.src   = url
      img.alt   = basename(path)
      img.title = 'Click to open full size'
      img.addEventListener('click', () => window.open(url, '_blank'))
      preview.appendChild(img)
    } else if (isAud) {
      const iconEl = document.createElement('div')
      iconEl.className = 'asset-icon'
      iconEl.textContent = '♫'
      iconEl.style.color = '#3fb950'
      preview.appendChild(iconEl)

      const url = URL.createObjectURL(new Blob([await blob.arrayBuffer()], { type: audioMime(path) }))
      this._objectUrls.push(url)

      const audio = document.createElement('audio')
      audio.className = 'audio-player'
      audio.controls  = true
      audio.src       = url
      preview.appendChild(audio)
    } else {
      // 3D or other binary — show an icon
      const iconEl = document.createElement('div')
      iconEl.className = 'asset-icon'
      iconEl.textContent = MODEL_EXTS.has(e) ? '⬡' : '▫'
      iconEl.style.color = MODEL_EXTS.has(e) ? '#bc8cff' : '#8b949e'
      preview.appendChild(iconEl)

      const sizeEl = document.createElement('div')
      sizeEl.style.cssText = 'font-size:10px;color:#484f58;margin-top:4px;'
      sizeEl.textContent = `${(blob.size / 1024).toFixed(1)} KB`
      preview.appendChild(sizeEl)
    }
  }
}
