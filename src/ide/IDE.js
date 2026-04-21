/**
 * Artlab IDE — main controller.
 *
 * Layout: sidebar | editor+output | 3D canvas
 *
 * Features:
 *  - Monaco editor with per-file models + view-state restore
 *  - Full multi-file tab strip (open, close, dirty tracking)
 *  - File tree with new / rename / delete (right-click context menu)
 *  - artlab.json editable in Monaco (json language)
 *  - Collapsible output panel: Errors (click-to-navigate) | Log | Compile
 *  - Export package as .zip (JSZip)
 *  - Resizable sidebar ↔ editor ↔ canvas splits
 *  - Collapsible output panel via drag handle
 *  - FPS counter in canvas toolbar
 *  - Pause / fullscreen canvas controls
 */

import { PreviewPane } from './PreviewPane.js'
import { lint, THREE_TYPES_DTS, TONE_TYPES_DTS } from './ArtlabLinter.js'

// Monaco uses 'javascript' language for all .js files
const JS_LANG = 'javascript'

// ── Artlab context type definitions injected into Monaco for autocomplete ─────
// Users get ctx.sphere(), ctx.Three, etc. without any imports.
const ARTLAB_TYPES_DTS = `
/** Artlab package context — passed to setup() and update(). Destructure what you need. */
interface ArtlabContext {
  /** Three.js namespace — access any Three.js class via ctx.Three */
  Three: typeof import('three');
  /** The Three.js scene */
  scene: import('three').Scene;
  /** The active perspective camera */
  camera: import('three').PerspectiveCamera;
  /** The WebGL renderer */
  renderer: import('three').WebGLRenderer;
  /** Seconds elapsed since setup() was called */
  elapsed: number;
  /** OrbitControls instance — configure target, minDistance, enabled, etc. */
  controls: { target: import('three').Vector3; enabled: boolean; minDistance: number; maxDistance: number; [key: string]: any };
  /** Load a texture by package-relative path; resolves from assets or HTTP */
  loadTexture(path: string): import('three').Texture;
  /** Add an object to the scene; returns the object */
  add<T extends import('three').Object3D>(obj: T): T;
  /** Remove an object from the scene */
  remove(obj: import('three').Object3D): void;
  // Geometry factories
  sphere(radius?: number, detail?: number): import('three').SphereGeometry;
  box(w?: number, h?: number, d?: number): import('three').BoxGeometry;
  cylinder(rt?: number, rb?: number, h?: number, segs?: number): import('three').CylinderGeometry;
  torus(R?: number, r?: number, ts?: number, rs?: number): import('three').TorusGeometry;
  plane(w?: number, h?: number, ws?: number, hs?: number): import('three').PlaneGeometry;
  ring(inner?: number, outer?: number, segs?: number): import('three').RingGeometry;
  cone(r?: number, h?: number, segs?: number): import('three').ConeGeometry;
  /** Wrap geometry in a MeshStandardMaterial mesh */
  mesh(geometry: import('three').BufferGeometry, options?: {
    color?: number | string; roughness?: number; metalness?: number;
    wireframe?: boolean; map?: string; emissiveMap?: string;
    emissive?: import('three').Color; [key: string]: any;
  }): import('three').Mesh;
  // Light factories
  ambient(color?: number | string, intensity?: number): import('three').AmbientLight;
  point(color?: number | string, intensity?: number, distance?: number, decay?: number): import('three').PointLight;
  directional(color?: number | string, intensity?: number): import('three').DirectionalLight;
  spot(color?: number | string, intensity?: number, distance?: number, angle?: number, penumbra?: number): import('three').SpotLight;
  hemisphere(sky?: number | string, ground?: number | string, intensity?: number): import('three').HemisphereLight;
  // Math helpers
  lerp(a: number, b: number, t: number): number;
  clamp(v: number, min: number, max: number): number;
  map(v: number, inMin: number, inMax: number, outMin: number, outMax: number): number;
  smoothstep(edge0: number, edge1: number, x: number): number;
  rad(degrees: number): number;
  deg(radians: number): number;
  // Three.js shorthand constructors
  vec2(x: number, y: number): import('three').Vector2;
  vec3(x: number, y: number, z: number): import('three').Vector3;
  vec4(x: number, y: number, z: number, w: number): import('three').Vector4;
  color(r: number, g: number, b: number): import('three').Color;
  quat(x: number, y: number, z: number, w: number): import('three').Quaternion;
  /** range(n) → [0..n-1]  |  range(a,b) → [a..b-1] */
  range(n: number): number[];
  range(a: number, b: number): number[];
  [key: string]: any;
}
declare const ctx: ArtlabContext;
`

// ── Built-in examples ──────────────────────────────────────────────────────────

const EXAMPLES = [
  { name: 'hello-cube',             entry: 'hello-cube.js',             description: 'A glowing rotating cube — the canonical first example' },
  { name: 'aurora',                 entry: 'aurora.js',                 description: 'A dome of stars beneath undulating aurora curtains' },
  { name: 'color-fields',           entry: 'color-fields.js',           description: 'A 20×20 animated grid creating a flowing color wave' },
  { name: 'wave-sculpture',         entry: 'wave-sculpture.js',         description: 'A 15×15 grid of spheres animated into a flowing wave' },
  { name: 'particle-storm',         entry: 'particle-storm.js',         description: '500 glowing embers spiraling outward' },
  { name: 'orbital-dance',          entry: 'orbital-dance.js',          description: 'Five colored spheres orbit a luminous sun' },
  { name: 'typography-art',         entry: 'typography-art.js',         description: 'Neon ARTLAB logotype with cycling quote subtitles' },
  { name: 'audio-pulse',            entry: 'audio-pulse.js',            description: 'Microphone-reactive sphere and satellite ring' },
  { name: 'music-synth',            entry: 'music-synth.js',            description: 'Generative music — scales, chords, sequencer, 3D visuals' },
  { name: 'camera-journey',         entry: 'camera-journey.js',         description: 'Dramatic central object with non-repeating camera orbit' },
  { name: 'canvas-2d',              entry: 'canvas-2d.js',              description: 'Canvas 2D generative art rendered as a live 3D texture' },
  { name: 'ui-showcase',            entry: 'ui-showcase.js',            description: 'Interactive HTML controls overlaid on 3D — buttons, sliders, tooltips' },
  { name: 'physics-particles',      entry: 'physics-particles.js',      description: 'Interactive particle fountain' },
  { name: 'video-fx',               entry: 'video-fx.js',               description: 'Live webcam with pixelate, glitch, and edge detection shaders' },
  { name: 'video-broadcast',        entry: 'video-broadcast.js',        description: 'Webcam with broadcast overlay — lower-third, live badge, ticker' },
  { name: 'video-kaleidoscope',     entry: 'video-kaleidoscope.js',     description: 'Real-time kaleidoscope GLSL shader on live webcam' },
  { name: 'solar-system',           entry: 'solar-system.js',           description: 'Audio-reactive 3D solar system — the reference demo' },
  { name: 'tutorial-01-geometry',   entry: 'tutorial-01-geometry.js',   description: 'Tutorial 01 — Geometry primitives and materials' },
  { name: 'tutorial-02-lights',     entry: 'tutorial-02-lights.js',     description: 'Tutorial 02 — Five lighting modes demonstrated live' },
  { name: 'tutorial-03-animation',  entry: 'tutorial-03-animation.js',  description: 'Tutorial 03 — Time-based animation patterns' },
  { name: 'tutorial-04-color',      entry: 'tutorial-04-color.js',      description: 'Tutorial 04 — Color spaces and PBR material parameters' },
  { name: 'tutorial-05-interaction',entry: 'tutorial-05-interaction.js',description: 'Tutorial 05 — Mouse interaction and raycasting' },
]

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * Parse and lightly validate an artlab.json manifest string.
 * Returns the parsed object; throws a descriptive TypeError on problems.
 */
function parseManifest(text) {
  let obj
  try { obj = JSON.parse(text) } catch (e) { throw new TypeError(`JSON parse error: ${e.message}`) }
  if (!obj || typeof obj !== 'object') throw new TypeError('Manifest must be a JSON object')
  if (typeof obj.name !== 'string' || !obj.name.trim()) throw new TypeError('"name" must be a non-empty string')
  if (typeof obj.entry !== 'string' || !obj.entry.trim()) throw new TypeError('"entry" must be a non-empty string')
  return obj
}

const MONACO_CDN  = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.50.0/min/vs/loader.js'
const MONACO_BASE = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.50.0/min/vs'
const JSZIP_CDN   = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js'
const DEBOUNCE_MS = 900

// ── Utilities ─────────────────────────────────────────────────────────────────

function debounce(fn, ms) {
  let t = null
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms) }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return }
    const s = document.createElement('script')
    s.src = src; s.onload = resolve
    s.onerror = () => reject(new Error(`Script load failed: ${src}`))
    document.head.appendChild(s)
  })
}

function ts() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`
}

let _jszip = null
async function getJSZip() {
  if (_jszip) return _jszip
  await loadScript(JSZIP_CDN)
  _jszip = window.JSZip
  return _jszip
}

// ── Toast ──────────────────────────────────────────────────────────────────────

let _toastTimer = null
function toast(msg, ms = 2500) {
  const el = document.getElementById('toast')
  if (!el) return
  el.textContent = msg
  el.classList.add('show')
  clearTimeout(_toastTimer)
  _toastTimer = setTimeout(() => el.classList.remove('show'), ms)
}

// ── Context menu ───────────────────────────────────────────────────────────────

const ctxMenu = document.getElementById('ctx-menu')
function showCtxMenu(x, y, items) {
  ctxMenu.innerHTML = ''
  for (const item of items) {
    if (item === '---') {
      const sep = document.createElement('div')
      sep.className = 'ctx-sep'
      ctxMenu.appendChild(sep)
    } else {
      const el = document.createElement('div')
      el.className = `ctx-item${item.danger ? ' danger' : ''}`
      el.textContent = item.label
      el.addEventListener('click', () => { hideCtxMenu(); item.action() })
      ctxMenu.appendChild(el)
    }
  }
  // Position, keeping on-screen
  const vw = window.innerWidth, vh = window.innerHeight
  const mw = 160, mh = items.length * 28
  ctxMenu.style.left = Math.min(x, vw - mw - 10) + 'px'
  ctxMenu.style.top  = Math.min(y, vh - mh - 10) + 'px'
  ctxMenu.classList.add('open')
}
function hideCtxMenu() { ctxMenu.classList.remove('open') }
document.addEventListener('click', hideCtxMenu)
document.addEventListener('keydown', e => { if (e.key === 'Escape') hideCtxMenu() })

// ── IDE class ─────────────────────────────────────────────────────────────────

export class IDE {
  constructor() {
    // Monaco
    this._monaco    = null
    this.editor     = null

    // Package state
    this.manifest   = null       // parsed artlab.json object
    this.artFiles   = new Map()  // filename → content string (text only)
    this.assetFiles = new Map()  // filename → Uint8Array (binary)

    // Editor state
    this._openFiles  = []         // ordered list of open filenames
    this._activeFile = null
    this._dirty      = new Set()  // filenames with unsaved changes
    this._models     = new Map()  // filename → Monaco ITextModel
    this._viewStates = new Map()  // filename → Monaco IViewState

    // Preview
    this.preview    = null
    this._paused    = false
    this._fpsSamples = []
    this._lastFpsTs = 0

    // Diagnostics
    this._errors    = []

    // Debounced auto-compile
    this._compile = debounce(() => this.compile(), DEBOUNCE_MS)

    // True while a built-in example is the active view (edits are not persisted)
    this._fromExample = false
  }

  // ── Initialisation ─────────────────────────────────────────────────────────

  async init() {
    this._initResizeHandles()
    this._initOutputTabs()
    this._initOutputHandle()
    this._bindToolbar()
    this._bindExamples()
    this._bindDrop()
    this._bindCanvasControls()

    // Preview
    const canvasContainer = document.getElementById('canvas-container')
    if (canvasContainer) {
      try {
        this.preview = new PreviewPane(canvasContainer)
        this.preview.onError = (msg) => this._addRuntimeError(msg)
      } catch (e) {
        console.warn('[IDE] PreviewPane init failed:', e)
      }
    }

    // FPS loop
    requestAnimationFrame(() => this._fpsLoop())

    // Monaco
    this._setBuild('', '—')
    try {
      await this._bootMonaco()
      document.getElementById('monaco-loading').style.display = 'none'
      document.getElementById('editor-placeholder').style.display = 'flex'
    } catch (err) {
      document.getElementById('monaco-loading').textContent =
        'Monaco failed — check network. ' + err.message
    }

    this._buildExamplesNav()
    this._initTutorial()

    // Deep-link: load example from URL hash; fall back to saved project.
    // Returns true if an example was loaded (hash takes priority over saved project).
    const _loadFromHash = () => {
      const name = location.hash.slice(1)
      if (!name) return false
      const ex = EXAMPLES.find(e => e.name === name)
      if (ex) { this._loadExample(ex); return true }
      return false
    }
    if (!_loadFromHash()) this._restoreProject()
    window.addEventListener('hashchange', _loadFromHash)
  }

  // ── Monaco bootstrap ────────────────────────────────────────────────────────

  async _bootMonaco() {
    await loadScript(MONACO_CDN)
    return new Promise((resolve, reject) => {
      window.require.config({ paths: { vs: MONACO_BASE } })
      window.require(['vs/editor/editor.main'], (monaco) => {
        try {
          this._monaco = monaco
          this._configureJS(monaco)
          this._defineTheme(monaco)
          this._createEditor(monaco)
          resolve()
        } catch (e) { reject(e) }
      }, reject)
    })
  }

  _configureJS(monaco) {
    const jsDefaults = monaco.languages.typescript.javascriptDefaults

    // Show syntax errors, not type errors (prevents confusing squiggles for
    // valid art code that doesn't satisfy strict type constraints)
    jsDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation:   false,
    })

    jsDefaults.setCompilerOptions({
      allowJs:              true,
      target:               monaco.languages.typescript.ScriptTarget.ESNext,
      module:               monaco.languages.typescript.ModuleKind.ESNext,
      allowNonTsExtensions: true,
      checkJs:              false,
    })

    // Inject Artlab context types — gives autocomplete on ctx.sphere(), ctx.Three, etc.
    jsDefaults.addExtraLib(ARTLAB_TYPES_DTS, 'artlab://types/artlab-context.d.ts')
    // Inject Three.js + Tone.js type declarations for deeper autocomplete
    jsDefaults.addExtraLib(THREE_TYPES_DTS, 'artlab://types/three.d.ts')
    jsDefaults.addExtraLib(TONE_TYPES_DTS, 'artlab://types/tone.d.ts')
  }

  _defineTheme(monaco) {
    monaco.editor.defineTheme('artlab-dark', {
      base: 'vs-dark', inherit: true,
      rules: [
        { token: 'comment',    foreground: '344060', fontStyle: 'italic' },
        { token: 'keyword',    foreground: '5a8cff', fontStyle: 'bold'   },
        { token: 'type',       foreground: 'c792ea'                      },
        { token: 'predefined', foreground: '82aaff'                      },
        { token: 'identifier', foreground: 'c8d8f0'                      },
        { token: 'number',     foreground: 'f78c6c'                      },
        { token: 'string',     foreground: 'c3e88d'                      },
        { token: 'operator',   foreground: '89ddff'                      },
        { token: 'delimiter',  foreground: '6a84a8'                      },
      ],
      colors: {
        'editor.background':               '#0f0f1a',
        'editor.foreground':               '#c8d8f0',
        'editorCursor.foreground':         '#5a8cff',
        'editor.lineHighlightBackground':  '#141428',
        'editorLineNumber.foreground':     '#344060',
        'editorLineNumber.activeForeground':'#6a84a8',
        'editor.selectionBackground':      '#1a2a4a',
        'editorBracketMatch.background':   '#1a2a4a88',
        'editorBracketMatch.border':       '#5a8cff',
        'editorWidget.background':         '#141428',
        'input.background':                '#0a0a14',
        'input.foreground':                '#c8d8f0',
        'scrollbarSlider.background':      '#34406044',
        'scrollbarSlider.hoverBackground': '#6a84a888',
      },
    })
  }

  _createEditor(monaco) {
    const wrap    = document.getElementById('monaco-wrap')
    const wrapDiv = document.createElement('div')
    wrapDiv.className = 'monaco-editor-wrapper'
    wrap.appendChild(wrapDiv)

    this.editor = monaco.editor.create(wrapDiv, {
      theme:               'artlab-dark',
      language:            JS_LANG,
      value:               '',
      fontSize:            13,
      fontFamily:          "JetBrains Mono, Fira Code, Cascadia Code, 'Courier New', monospace",
      fontLigatures:       true,
      lineNumbers:         'on',
      minimap:             { enabled: true, scale: 1, renderCharacters: false },
      renderWhitespace:    'boundary',
      scrollBeyondLastLine: false,
      automaticLayout:     true,
      tabSize:             2,
      insertSpaces:        true,
      wordWrap:            'off',
      bracketPairColorization: { enabled: true },
      padding:             { top: 8 },
      smoothScrolling:     true,
      cursorSmoothCaretAnimation: 'on',
      renderLineHighlight: 'line',
    })

    // Cursor → status bar
    this.editor.onDidChangeCursorPosition(e => {
      const { lineNumber: ln, column: col } = e.position
      const el = document.getElementById('st-cursor')
      if (el) el.textContent = `Ln ${ln}, Col ${col}`
    })

    // Debounced lint (faster than compile — purely static, no blob import)
    const lintDebounced = debounce(() => this._lintActive(), 220)

    // Auto-compile on change
    this.editor.onDidChangeModelContent(() => {
      if (this._activeFile) {
        this._dirty.add(this._activeFile)
        this._renderTabs()
      }
      lintDebounced()
      this._compile()
    })

    // Keyboard shortcuts
    this.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => this.saveActive())
    this.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => this.compile())
  }

  // ── Package loading ─────────────────────────────────────────────────────────

  // ── Directory loading (File System Access API) ──────────────────────────────

  async loadDirectory() {
    if (!window.showDirectoryPicker) {
      toast('Directory picker not supported in this browser', 4000); return
    }
    let dirHandle
    try { dirHandle = await window.showDirectoryPicker({ mode: 'read' }) } catch (e) {
      if (e.name !== 'AbortError') toast(`Could not open directory: ${e.message}`, 4000)
      return
    }

    const manifestHandle = await dirHandle.getFileHandle('artlab.json', { create: false }).catch(() => null)
    if (!manifestHandle) { toast('artlab.json not found in directory', 4000); return }

    let manifest
    try {
      manifest = parseManifest(await (await manifestHandle.getFile()).text())
    } catch (e) {
      toast(`Invalid manifest: ${e.message}`, 4000); return
    }

    this.artFiles.clear()
    this.assetFiles.clear()

    // Recursively read all files from directory
    await this._readDirHandle(dirHandle, '', manifest)

    this.manifest = manifest
    this._reset()
    this._updatePkgLabel()
    this._enablePkgButtons(true)
    this._logCompile(`Loaded directory "${manifest.name}" v${manifest.version}`)
    this._logCompile(`Files: ${[...this.artFiles.keys()].join(', ')}`)

    const entryName = manifest.entry ?? [...this.artFiles.keys()].find(k => k.endsWith('.js'))
    if (entryName && this.artFiles.has(entryName)) this.openFile(entryName)

    this._fromExample = false
    history.replaceState(null, '', location.pathname + location.search)
    this._addProjectToNav(manifest.name)
    toast(`Opened ${manifest.name} (directory)`)
    await this.compile()
  }

  async _readDirHandle(dirHandle, prefix, manifest) {
    for await (const [name, handle] of dirHandle.entries()) {
      const path = prefix ? `${prefix}/${name}` : name
      if (handle.kind === 'directory') {
        await this._readDirHandle(handle, path, manifest)
      } else {
        const file = await handle.getFile()
        if (name.endsWith('.js') || name.endsWith('.ts') || name.endsWith('.json')
            || name.endsWith('.css') || name.endsWith('.html') || name === 'artlab.json') {
          this.artFiles.set(path, await file.text())
        } else if (!name.startsWith('.')) {
          this.assetFiles.set(path, new Uint8Array(await file.arrayBuffer()))
        }
      }
    }
  }

  async loadPackage(file) {
    const JSZip = await getJSZip()
    let zip
    try { zip = await JSZip.loadAsync(file) } catch (e) {
      toast(`Failed to open zip: ${e.message}`, 4000); return
    }

    const manifestEntry = zip.file('artlab.json')
    if (!manifestEntry) { toast('artlab.json not found', 4000); return }

    let manifest
    try {
      manifest = parseManifest(await manifestEntry.async('string'))
    } catch (e) {
      toast(`Invalid manifest: ${e.message}`, 4000); return
    }

    // Load all files
    this.artFiles.clear()
    this.assetFiles.clear()

    for (const [path, entry] of Object.entries(zip.files)) {
      if (entry.dir) continue
      const isText = path.endsWith('.js') || path.endsWith('.ts')
                  || path.endsWith('.json') || path.endsWith('.css')
                  || path.endsWith('.html') || path === 'artlab.json'
      if (isText) {
        this.artFiles.set(path, await entry.async('string'))
      } else {
        this.assetFiles.set(path, await entry.async('uint8array'))
      }
    }

    this.manifest = manifest
    this._reset()
    this._updatePkgLabel()
    this._enablePkgButtons(true)
    this._logCompile(`Loaded package "${manifest.name}" v${manifest.version}`)
    this._logCompile(`Files: ${[...this.artFiles.keys()].join(', ')}`)

    // Open entry file first
    const entryName = manifest.entry ?? [...this.artFiles.keys()].find(k => k.endsWith('.js'))
    if (entryName && this.artFiles.has(entryName)) this.openFile(entryName)

    this._fromExample = false
    history.replaceState(null, '', location.pathname + location.search)
    this._addProjectToNav(manifest.name)
    toast(`Opened ${manifest.name} v${manifest.version}`)
    await this.compile()
  }

  // ── File operations ─────────────────────────────────────────────────────────

  openFile(filename) {
    if (!this.artFiles.has(filename)) return

    // Save view state for current
    if (this._activeFile && this.editor) {
      this._viewStates.set(this._activeFile, this.editor.saveViewState())
    }

    // Track open files
    if (!this._openFiles.includes(filename)) {
      this._openFiles.push(filename)
    }
    this._activeFile = filename

    if (this.editor) {
      let model = this._models.get(filename)
      if (!model) {
        const src  = this.artFiles.get(filename) ?? ''
        const lang = filename === 'artlab.json' ? 'json'
                   : filename.endsWith('.js')   ? JS_LANG
                   : filename.endsWith('.ts')   ? 'typescript'
                   : filename.endsWith('.css')  ? 'css'
                   : filename.endsWith('.html') ? 'html'
                   : 'plaintext'
        model = this._monaco.editor.createModel(src, lang)
        this._models.set(filename, model)
      }
      this.editor.setModel(model)
      const vs = this._viewStates.get(filename)
      if (vs) this.editor.restoreViewState(vs)
      document.getElementById('editor-placeholder').style.display = 'none'
    }

    this._renderTabs()
    this._renderFileTree()
    document.getElementById('st-file').textContent = filename
  }

  closeFile(filename) {
    // Save content from model if dirty
    if (this._dirty.has(filename) && this.editor && this._models.has(filename)) {
      const model = this._models.get(filename)
      this.artFiles.set(filename, model.getValue())
    }

    const idx = this._openFiles.indexOf(filename)
    if (idx >= 0) this._openFiles.splice(idx, 1)

    this._models.get(filename)?.dispose()
    this._models.delete(filename)
    this._viewStates.delete(filename)
    this._dirty.delete(filename)

    // Switch to adjacent file
    if (this._activeFile === filename) {
      const next = this._openFiles[Math.max(0, idx - 1)]
      this._activeFile = null
      if (next) {
        this.openFile(next)
      } else {
        if (this.editor) {
          this.editor.setModel(this._monaco.editor.createModel('', JS_LANG))
          document.getElementById('editor-placeholder').style.display = 'flex'
        }
        document.getElementById('st-file').textContent = 'no file open'
      }
    }
    this._renderTabs()
    this._renderFileTree()
  }

  saveActive() {
    if (!this._activeFile || !this.editor) return
    const content = this.editor.getValue()
    this.artFiles.set(this._activeFile, content)
    this._dirty.delete(this._activeFile)
    this._renderTabs()
    // Sync model so it matches artFiles
    toast('Saved')
  }

  newFile(name) {
    if (!name) {
      name = window.prompt('New file name (e.g. scene.js):')
      if (!name) return
    }
    if (!name.endsWith('.js') && !name.endsWith('.json') && !name.endsWith('.css')) name += '.js'
    if (this.artFiles.has(name)) { toast('File already exists'); return }

    const stub = name.endsWith('.js') ? [
      `// ${name}`,
      '',
      'export function setup(ctx) {',
      '  const { Three, sphere, mesh, box, ambient, point } = ctx',
      '}',
      '',
      'export function update(ctx, dt) {',
      '  // dt = seconds since last frame, ctx.elapsed = total seconds',
      '}',
    ].join('\n') : ''

    this.artFiles.set(name, stub)
    this._renderFileTree()
    this.openFile(name)
    toast(`Created ${name}`)
  }

  renameFile(oldName) {
    const newName = window.prompt('Rename to:', oldName)
    if (!newName || newName === oldName) return
    if (this.artFiles.has(newName)) { toast('A file with that name already exists'); return }

    // Get current content (from model if open)
    let content = this.artFiles.get(oldName) ?? ''
    if (this._models.has(oldName)) content = this._models.get(oldName).getValue()

    this.artFiles.delete(oldName)
    this.artFiles.set(newName, content)

    // Update manifest entry if needed
    if (this.manifest?.entry === oldName) this.manifest.entry = newName

    // Close old, dispose model, open new
    const wasOpen   = this._openFiles.includes(oldName)
    const wasActive = this._activeFile === oldName
    const idx       = this._openFiles.indexOf(oldName)

    if (wasOpen) {
      this._models.get(oldName)?.dispose()
      this._models.delete(oldName)
      this._viewStates.delete(oldName)
      this._dirty.delete(oldName)
      if (idx >= 0) this._openFiles.splice(idx, 1, newName)
    }

    if (wasActive) {
      this._activeFile = null
      this.openFile(newName)
    } else {
      this._renderFileTree()
      this._renderTabs()
    }
    toast(`Renamed to ${newName}`)
  }

  deleteFile(filename) {
    if (!confirm(`Delete "${filename}"?`)) return
    if (this._openFiles.includes(filename)) this.closeFile(filename)
    this.artFiles.delete(filename)
    this._models.get(filename)?.dispose()
    this._models.delete(filename)
    this._renderFileTree()
    toast(`Deleted ${filename}`)
  }

  // ── Export ──────────────────────────────────────────────────────────────────

  async exportPackage() {
    if (!this.manifest) { toast('No package loaded'); return }

    // Flush active file
    if (this._activeFile && this.editor) {
      this.artFiles.set(this._activeFile, this.editor.getValue())
    }

    const JSZip = await getJSZip()
    const zip   = new JSZip()

    // Always write manifest (possibly edited)
    const manifestSrc = this.artFiles.get('artlab.json') ?? JSON.stringify(this.manifest, null, 2)
    zip.file('artlab.json', manifestSrc)

    for (const [path, content] of this.artFiles) {
      if (path !== 'artlab.json') zip.file(path, content)
    }
    for (const [path, bytes] of this.assetFiles) {
      zip.file(path, bytes)
    }

    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
    const name = `${this.manifest.name}-${this.manifest.version}.zip`
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = name; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
    toast(`Exported ${name}`)
  }

  // ── Compilation ─────────────────────────────────────────────────────────────

  async compile() {
    if (!this.manifest || !this.preview) return

    // Flush active editor content
    if (this._activeFile && this.editor) {
      this.artFiles.set(this._activeFile, this.editor.getValue())
    }

    this._setBuild('building', 'Building…')
    this._logCompile(`[${ts()}] Building ${this.manifest.name}…`)

    try {
      await this.preview.run({ manifest: this.manifest, artFiles: this.artFiles, assetFiles: this.assetFiles })
      this._setBuild('ok', '✓ OK')
      this._setErrors([])
      this._logCompile(`[${ts()}] Build OK`)
      this._saveProject()
    } catch (err) {
      this._setBuild('error', '✗ Error')
      const diags = this._parseError(err.message)
      this._setErrors(diags)
      this._logCompile(`[${ts()}] Error: ${err.message}`)
    }
  }

  // ── Live linting ─────────────────────────────────────────────────────────────

  _lintActive() {
    if (!this._activeFile || !this.editor || !this._monaco) return
    const filename = this._activeFile
    if (!filename.endsWith('.js')) return

    const source = this.editor.getValue()
    const diags  = lint(source, filename)

    const model = this.editor.getModel()
    if (!model) return

    const MS = this._monaco.MarkerSeverity
    const markers = diags.map(d => ({
      severity:        d.severity === 'error' ? MS.Error
                     : d.severity === 'warn'  ? MS.Warning
                     : MS.Info,
      message:         d.message,
      startLineNumber: d.line  ?? 1,
      endLineNumber:   d.line  ?? 1,
      startColumn:     d.col   ?? 1,
      endColumn:       (d.col ?? 1) + 80,
      source:          'artlab',
    }))

    this._monaco.editor.setModelMarkers(model, 'artlab', markers)
  }

  // ── localStorage project persistence ────────────────────────────────────────

  _saveProject() {
    if (!this.manifest || this._fromExample) return
    try {
      localStorage.setItem('artlab:project', JSON.stringify({
        manifest:   this.manifest,
        artFiles:   Object.fromEntries(this.artFiles),
        activeFile: this._activeFile,
      }))
    } catch (e) {
      console.warn('[IDE] localStorage save failed:', e.message)
    }
  }

  _restoreProject() {
    let data
    try {
      const raw = localStorage.getItem('artlab:project')
      if (!raw) return
      data = JSON.parse(raw)
      if (!data?.manifest?.name || !data?.manifest?.entry) return
    } catch (e) {
      console.warn('[IDE] localStorage restore failed:', e.message)
      return
    }

    this.manifest = data.manifest
    this.artFiles = new Map(Object.entries(data.artFiles ?? {}))
    this.assetFiles.clear()
    this._fromExample = false

    this._reset()
    this._updatePkgLabel()
    this._enablePkgButtons(true)
    this._addProjectToNav(this.manifest.name)

    const file = data.activeFile ?? this.manifest.entry
    if (file && this.artFiles.has(file)) this.openFile(file)

    this.compile()
  }

  _parseError(msg) {
    // Try to extract file:line:col from error messages
    const match = msg.match(/([^:]+\.js):(\d+)(?::(\d+))?/)
    if (match) {
      return [{ severity: 'error', message: msg, file: match[1], line: Number(match[2]), col: Number(match[3] ?? 1) }]
    }
    return [{ severity: 'error', message: msg }]
  }

  // ── Diagnostics ─────────────────────────────────────────────────────────────

  _addRuntimeError(msg) {
    // Switch to the Errors tab so the user sees it
    document.querySelectorAll('.output-tab').forEach(t => t.classList.remove('active'))
    document.querySelectorAll('.output-pane').forEach(p => p.classList.remove('active'))
    document.querySelector('.output-tab[data-out="errors"]')?.classList.add('active')
    document.getElementById('out-errors')?.classList.add('active')

    // Append as a runtime diagnostic (doesn't overwrite compile errors)
    const existing = [...this._errors]
    existing.push({ severity: 'error', message: msg, runtime: true })
    this._setErrors(existing)
  }

  _setErrors(diags) {
    this._errors = diags
    const errCount = diags.filter(d => d.severity === 'error').length
    const badge = document.getElementById('error-badge')
    if (badge) badge.textContent = errCount > 0 ? String(errCount) : ''

    const panel = document.getElementById('out-errors')
    if (!panel) return

    if (diags.length === 0) {
      panel.innerHTML = '<div class="output-empty">No diagnostics.</div>'
      return
    }

    panel.innerHTML = ''
    for (const d of diags) {
      const row = document.createElement('div')
      row.className = 'diag-row'

      const icon = document.createElement('div')
      icon.className = `diag-icon ${d.severity === 'warn' ? 'warn' : d.severity === 'info' ? 'info' : 'err'}`
      icon.textContent = d.severity === 'warn' ? '▲' : d.severity === 'info' ? 'ℹ' : '✖'

      const content = document.createElement('div')
      content.className = 'diag-content'

      const msg = document.createElement('div')
      msg.className = 'diag-msg'
      msg.textContent = d.message

      content.appendChild(msg)

      if (d.file || d.line) {
        const loc = document.createElement('div')
        loc.className = 'diag-loc'
        loc.textContent = [d.file, d.line, d.col].filter(Boolean).join(':')
        content.appendChild(loc)
      }

      row.appendChild(icon)
      row.appendChild(content)

      // Click-to-navigate: switch to correct file + jump to line
      if (d.file || d.line) {
        row.addEventListener('click', () => {
          const target = d.file ?? this._activeFile
          if (target && this.artFiles.has(target)) {
            if (this._activeFile !== target) this.openFile(target)
          }
          if (this.editor && d.line) {
            this.editor.revealLineInCenter(d.line)
            this.editor.setPosition({ lineNumber: d.line, column: d.col ?? 1 })
            this.editor.focus()
          }
          // Switch to errors tab
          this._showOutputPane('errors')
        })
      }

      panel.appendChild(row)
    }

    // Auto-show errors tab when errors appear
    if (errCount > 0) this._showOutputPane('errors')
  }

  log(level, message) {
    const panel = document.getElementById('out-log')
    if (!panel) return

    const empty = panel.querySelector('.output-empty')
    if (empty) empty.remove()

    const row = document.createElement('div')
    row.className = 'log-row'

    const time = document.createElement('span')
    time.className = 'log-time'
    time.textContent = ts()

    const lvl = document.createElement('span')
    lvl.className = `log-level ${level}`
    lvl.textContent = level.toUpperCase()

    const msg = document.createElement('span')
    msg.className = 'log-msg'
    msg.textContent = message

    row.appendChild(time)
    row.appendChild(lvl)
    row.appendChild(msg)
    panel.appendChild(row)
    panel.scrollTop = panel.scrollHeight
  }

  _logCompile(msg) {
    const panel = document.getElementById('out-compile')
    if (!panel) return

    const empty = panel.querySelector('.output-empty')
    if (empty) empty.remove()

    const row = document.createElement('div')
    row.className = 'log-row'
    const m = document.createElement('span')
    m.className = 'log-msg'
    m.style.color = 'var(--text-dim)'
    m.textContent = msg
    row.appendChild(m)
    panel.appendChild(row)
    panel.scrollTop = panel.scrollHeight
  }

  // ── Render: tabs ────────────────────────────────────────────────────────────

  _renderTabs() {
    const strip = document.getElementById('tab-strip')
    const newBtn = document.getElementById('tab-new')
    if (!strip) return

    strip.innerHTML = ''

    for (const filename of this._openFiles) {
      const tab = document.createElement('div')
      tab.className = `tab${filename === this._activeFile ? ' active' : ''}${this._dirty.has(filename) ? ' dirty' : ''}`

      const name = document.createElement('span')
      name.className = 'tab-name'
      name.textContent = filename.split('/').pop()
      name.title = filename

      const close = document.createElement('button')
      close.className = 'tab-close'
      close.textContent = '×'
      close.title = 'Close'
      close.addEventListener('click', e => { e.stopPropagation(); this.closeFile(filename) })

      tab.appendChild(name)
      tab.appendChild(close)
      tab.addEventListener('click', () => this.openFile(filename))
      strip.appendChild(tab)
    }

    // Re-append the + button
    if (newBtn) strip.appendChild(newBtn)
  }

  // ── Render: file tree ────────────────────────────────────────────────────────

  _renderFileTree() {
    const tree = document.getElementById('file-tree')
    if (!tree) return

    if (!this.manifest) {
      // No package loaded — ensure nav sections remain intact (don't replace with drop zone)
      // Remove any stale pkg-file-list if it exists
      tree.querySelector('#pkg-file-list')?.remove()
      return
    }

    // Remove any existing pkg-file-list section and rebuild it
    tree.querySelector('#pkg-file-list')?.remove()

    const list = document.createElement('div')
    list.id = 'pkg-file-list'

    const files = [...this.artFiles.keys()].sort((a, b) => {
      if (a === 'artlab.json') return -1
      if (b === 'artlab.json') return  1
      return a.localeCompare(b)
    })

    for (const filename of files) {
      const isEntry    = filename === (this.manifest.entry ?? 'main.js')
      const isManifest = filename === 'artlab.json'
      const isActive   = filename === this._activeFile

      const row = document.createElement('div')
      row.className = [
        'tree-row',
        isActive   ? 'active'   : '',
        isEntry    ? 'entry'    : '',
        isManifest ? 'manifest' : '',
      ].filter(Boolean).join(' ')

      const icon = document.createElement('span')
      icon.className = 'tree-icon'
      icon.textContent = isManifest ? '⚙' : isEntry ? '▶' : '·'

      const name = document.createElement('span')
      name.className = 'tree-name'
      name.textContent = filename
      name.title = filename

      const actions = document.createElement('span')
      actions.className = 'tree-actions'

      if (!isManifest) {
        const renameBtn = document.createElement('button')
        renameBtn.className = 'tree-action-btn'
        renameBtn.textContent = '✎'
        renameBtn.title = 'Rename'
        renameBtn.addEventListener('click', e => { e.stopPropagation(); this.renameFile(filename) })

        const delBtn = document.createElement('button')
        delBtn.className = 'tree-action-btn del'
        delBtn.textContent = '✕'
        delBtn.title = 'Delete'
        delBtn.addEventListener('click', e => { e.stopPropagation(); this.deleteFile(filename) })

        actions.appendChild(renameBtn)
        actions.appendChild(delBtn)
      }

      row.appendChild(icon)
      row.appendChild(name)
      row.appendChild(actions)

      row.addEventListener('click', () => this.openFile(filename))
      row.addEventListener('contextmenu', e => {
        e.preventDefault()
        const items = [
          { label: 'Open',                    action: () => this.openFile(filename) },
          '---',
          { label: 'Rename',                  action: () => this.renameFile(filename) },
        ]
        if (!isManifest) {
          items.push({ label: 'Delete', danger: true, action: () => this.deleteFile(filename) })
        }
        if (this.manifest && !isManifest) {
          items.splice(1, 0, { label: 'Set as entry', action: () => {
            this.manifest.entry = filename
            // Update manifest file content too
            const manifestContent = JSON.stringify(this.manifest, null, 2)
            this.artFiles.set('artlab.json', manifestContent)
            if (this._models.has('artlab.json')) this._models.get('artlab.json').setValue(manifestContent)
            this._renderFileTree()
            toast(`Entry set to ${filename}`)
          }})
        }
        showCtxMenu(e.clientX, e.clientY, items)
      })

      list.appendChild(row)
    }

    // Assets section
    if (this.assetFiles.size > 0) {
      const label = document.createElement('div')
      label.className = 'tree-section-label'
      label.textContent = 'Assets'
      list.appendChild(label)

      for (const filename of [...this.assetFiles.keys()].sort()) {
        const row = document.createElement('div')
        row.className = 'tree-row'
        const icon = document.createElement('span')
        icon.className = 'tree-icon'
        const ext = filename.split('.').pop()?.toLowerCase() ?? ''
        icon.textContent = ['png','jpg','jpeg','webp'].includes(ext) ? '🖼' :
                           ['mp3','ogg','wav'].includes(ext)          ? '♪'  :
                           ['glb','gltf','obj'].includes(ext)         ? '⬡'  : '■'
        const name = document.createElement('span')
        name.className = 'tree-name'
        name.textContent = filename
        row.appendChild(icon); row.appendChild(name)
        list.appendChild(row)
      }
    }

    tree.appendChild(list)
  }

  // ── Status + build ──────────────────────────────────────────────────────────

  _setBuild(state, text) {
    const cells = [document.getElementById('tb-build'), document.getElementById('st-build')]
    for (const el of cells) {
      if (!el) continue
      el.className = state ? (el.id === 'tb-build' ? state : `status-cell right ${state}`) : (el.id === 'tb-build' ? '' : 'status-cell right')
      el.textContent = text
    }
  }

  _updatePkgLabel() {
    const el  = document.getElementById('pkg-name')
    const stl = document.getElementById('st-pkg')
    if (!this.manifest) { if (el) { el.textContent = 'no package'; el.className = 'pkg-name' }; return }
    const label = `${this.manifest.name} v${this.manifest.version}`
    if (el)  { el.textContent = label; el.className = 'pkg-name loaded' }
    if (stl) stl.textContent = label
  }

  _enablePkgButtons(on) {
    const ids = ['btn-save', 'btn-run', 'btn-export', 'btn-new-file']
    for (const id of ids) {
      const el = document.getElementById(id)
      if (el) el.disabled = !on
    }
  }

  _reset() {
    // Close all open files
    for (const [, model] of this._models) model.dispose()
    this._models.clear()
    this._viewStates.clear()
    this._dirty.clear()
    this._openFiles = []
    this._activeFile = null
    this._renderTabs()
    this._renderFileTree()
    if (this.editor) {
      this.editor.setModel(this._monaco?.editor.createModel('', JS_LANG) ?? null)
      document.getElementById('editor-placeholder').style.display = 'flex'
    }
    document.getElementById('st-file').textContent = 'no file open'
  }

  // ── New package scaffold ─────────────────────────────────────────────────────

  newPackage() {
    const name = window.prompt('Package name (kebab-case):', 'my-scene')
    if (!name) return

    this.manifest = { name, version: '1.0.0', entry: 'main.js' }
    this.artFiles.clear()
    this.assetFiles.clear()

    const stub = [
      `// ${name} — Artlab scene`,
      '',
      'export function setup(ctx) {',
      '  const { Three, sphere, mesh, box, ambient, point } = ctx',
      '',
      '  const geo = box(1, 1, 1)',
      '  const mat = new Three.MeshStandardMaterial({ color: 0x4488cc })',
      '  const cube = new Three.Mesh(geo, mat)',
      '  ctx.add(cube)',
      '  ctx.add(ambient(0x404060, 0.8))',
      '  ctx.add(point(0xffffff, 200, 0, 0, 0, 2))',
      '',
      '  ctx._cube = cube',
      '}',
      '',
      'export function update(ctx, dt) {',
      '  if (ctx._cube) {',
      '    ctx._cube.rotation.x += dt * 0.4',
      '    ctx._cube.rotation.y += dt * 0.7',
      '  }',
      '}',
    ].join('\n')

    this.artFiles.set('main.js', stub)
    this.artFiles.set('artlab.json', JSON.stringify(this.manifest, null, 2))

    this._fromExample = false
    history.replaceState(null, '', location.pathname + location.search)
    this._reset()
    this._updatePkgLabel()
    this._enablePkgButtons(true)
    this.openFile('main.js')
    toast(`Created package "${name}"`)
  }

  // ── Output panel ─────────────────────────────────────────────────────────────

  _initOutputTabs() {
    document.querySelectorAll('.output-tab[data-out]').forEach(tab => {
      tab.addEventListener('click', () => this._showOutputPane(tab.dataset.out))
    })
  }

  _showOutputPane(id) {
    document.querySelectorAll('.output-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.out === id)
    })
    document.querySelectorAll('.output-pane').forEach(p => {
      p.classList.toggle('active', p.id === `out-${id}`)
    })
  }

  _initOutputHandle() {
    const handle  = document.getElementById('handle-output')
    const panel   = document.getElementById('output-panel')
    const colBtn  = document.getElementById('btn-collapse-output')
    if (!handle || !panel) return

    let collapsed = false
    let savedH    = 140

    colBtn?.addEventListener('click', () => {
      collapsed = !collapsed
      if (collapsed) {
        savedH = panel.clientHeight
        panel.style.height = '26px'
        colBtn.textContent = '▴'
      } else {
        panel.style.height = savedH + 'px'
        colBtn.textContent = '▾'
      }
    })

    handle.addEventListener('pointerdown', e => {
      e.preventDefault()
      const startY = e.clientY
      const startH = panel.clientHeight
      handle.setPointerCapture(e.pointerId)
      handle.classList.add('dragging')
      document.body.style.userSelect = 'none'

      const onMove = e => {
        const dy   = startY - e.clientY
        const newH = Math.max(60, Math.min(window.innerHeight * 0.5, startH + dy))
        panel.style.height = newH + 'px'
        if (collapsed && dy > 10) { collapsed = false; colBtn && (colBtn.textContent = '▾') }
        this._editor?.layout?.()
      }
      const onUp = () => {
        handle.classList.remove('dragging')
        document.body.style.userSelect = ''
        handle.removeEventListener('pointermove', onMove)
        handle.removeEventListener('pointerup', onUp)
      }
      handle.addEventListener('pointermove', onMove)
      handle.addEventListener('pointerup', onUp)
    })
  }

  // ── Resize handles ─────────────────────────────────────────────────────────

  _initResizeHandles() {
    const sidebar = document.getElementById('sidebar')
    const canvas  = document.getElementById('canvas-zone')

    this._makeDraggable(
      document.getElementById('handle-left'),
      dx => {
        const newW = Math.max(120, Math.min(400, sidebar.clientWidth + dx))
        sidebar.style.width = newW + 'px'
        this._onResizeDone()
      }
    )

    this._makeDraggable(
      document.getElementById('handle-right'),
      dx => {
        const newW = Math.max(200, Math.min(window.innerWidth * 0.75, canvas.clientWidth - dx))
        canvas.style.width = newW + 'px'
        this._onResizeDone()
      }
    )
  }

  _makeDraggable(handle, onDrag) {
    if (!handle) return
    let lastX = 0

    handle.addEventListener('pointerdown', e => {
      e.preventDefault()
      lastX = e.clientX
      handle.setPointerCapture(e.pointerId)
      handle.classList.add('dragging')
      document.body.style.userSelect = 'none'

      const onMove = e => {
        onDrag(e.clientX - lastX)
        lastX = e.clientX
      }
      const onUp = () => {
        handle.classList.remove('dragging')
        document.body.style.userSelect = ''
        handle.removeEventListener('pointermove', onMove)
        handle.removeEventListener('pointerup', onUp)
      }
      handle.addEventListener('pointermove', onMove)
      handle.addEventListener('pointerup', onUp)
    })
  }

  _onResizeDone() {
    this._editor?.layout?.()
    this.preview?.renderer?.setSize?.(
      this.preview.renderer.domElement.parentElement?.clientWidth ?? 0,
      this.preview.renderer.domElement.parentElement?.clientHeight ?? 0
    )
  }

  // ── Toolbar + sidebar button wiring ────────────────────────────────────────

  _bindToolbar() {
    const wire = (id, fn) => document.getElementById(id)?.addEventListener('click', fn)

    wire('btn-open',     () => document.getElementById('file-input')?.click())
    wire('btn-open-dir', () => this.loadDirectory())
    wire('btn-new-pkg',  () => this.newPackage())
    wire('btn-examples', () => this._openExamplesGallery())
    wire('btn-save',     () => this.saveActive())
    wire('btn-run',      () => this.compile())
    wire('btn-export',   () => this.exportPackage())
    wire('btn-new-file', () => this.newFile())
    wire('tab-new',      () => this.newFile())

    document.getElementById('file-input')?.addEventListener('change', e => {
      const file = e.target.files?.[0]
      if (file) this.loadPackage(file)
      e.target.value = ''
    })

    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); this.saveActive() }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); this.compile() }
    })
  }

  // ── Examples gallery ────────────────────────────────────────────────────────

  _bindExamples() {
    const modal = document.getElementById('examples-modal')
    if (!modal) return

    document.getElementById('close-examples')?.addEventListener('click', () => {
      modal.style.display = 'none'
    })

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && modal.style.display !== 'none') {
        modal.style.display = 'none'
      }
    })
  }

  _openExamplesGallery() {
    const modal = document.getElementById('examples-modal')
    const grid  = document.getElementById('examples-grid')
    if (!modal || !grid) return

    // Populate the grid (idempotent — only build once)
    if (!grid.dataset.built) {
      grid.dataset.built = '1'
      for (const ex of EXAMPLES) {
        const card = document.createElement('div')
        card.style.cssText = 'background:#141428; border:1px solid rgba(90,120,200,.16); border-radius:3px; padding:16px; cursor:pointer; transition:border-color .12s;'
        card.addEventListener('mouseenter', () => { card.style.borderColor = 'rgba(80,140,255,.5)' })
        card.addEventListener('mouseleave', () => { card.style.borderColor = 'rgba(90,120,200,.16)' })

        const nameEl = document.createElement('div')
        nameEl.style.cssText = 'font-family:monospace; font-size:11px; color:#5a8cff; letter-spacing:.1em; margin-bottom:6px;'
        nameEl.textContent = ex.name

        const descEl = document.createElement('div')
        descEl.style.cssText = 'font-size:11px; color:#6a84a8; line-height:1.5;'
        descEl.textContent = ex.description

        card.appendChild(nameEl)
        card.appendChild(descEl)

        card.addEventListener('click', () => {
          modal.style.display = 'none'
          this._loadExample(ex)
        })

        grid.appendChild(card)
      }
    }

    modal.style.display = 'block'
  }

  async _loadExample(ex) {
    this._fromExample = true
    // Clear previous runtime errors when switching examples
    this._setErrors([])

    // Highlight in tree
    document.querySelectorAll('.ex-row').forEach(r => r.classList.remove('active'))
    const row = document.querySelector(`.ex-row[data-name="${ex.name}"]`)
    row?.classList.add('active')

    // Update sidebar label
    const pkgName = document.getElementById('pkg-name')
    if (pkgName) { pkgName.textContent = ex.name; pkgName.classList.add('loaded') }

    // Load into preview via real URL (supports relative imports).
    // import.meta.env.BASE_URL is '/' in dev and the configured base in prod
    // (e.g. '/artlab/' on GitHub Pages), so paths resolve correctly everywhere.
    const url = new URL(
      `${import.meta.env.BASE_URL}examples/${ex.name}/${ex.entry}`,
      location.href,
    ).href
    let mod
    try { mod = await import(/* @vite-ignore */ url) } catch (err) {
      console.error('[IDE] Example load failed:', err)
      this._runtimeError(`Failed to load '${ex.name}': ${err.message || String(err)}`)
      return
    }
    this.preview?.runFromModule(mod)

    // Fetch source and show in Monaco
    try {
      const raw = await fetch(url).then(r => r.text())
      const src = raw.replace(/\/\/# sourceMappingURL=data:[^\n]+\n?$/, '')
      // Store in artFiles so openFile() can find it
      this.artFiles.set(ex.entry, src)
      // Open in editor
      if (this.editor && this._monaco) {
        // Dispose old model for this file if it exists
        const old = this._models.get(ex.entry)
        if (old) { old.dispose(); this._models.delete(ex.entry) }
        this.openFile(ex.entry)
      }
    } catch (err) {
      console.warn('[IDE] Could not fetch example source:', err)
    }

    toast(`Loaded example: ${ex.name}`)
    this._tut?.tryLoad(ex)

    // Update the URL hash so this view is bookmarkable and shareable
    history.replaceState(null, '', `#${ex.name}`)
  }

  // ── Project Navigator ────────────────────────────────────────────────────────

  _buildExamplesNav() {
    // Collapse toggle for EXAMPLES section
    const hdr = document.getElementById('nav-examples-hdr')
    const body = document.getElementById('nav-examples-body')
    hdr?.addEventListener('click', () => {
      const collapsed = body.classList.toggle('collapsed')
      hdr.classList.toggle('collapsed', collapsed)
    })

    // Same for PROJECTS section
    const phdr = document.querySelector('#nav-projects .nav-section-hdr')
    const pbody = document.getElementById('nav-projects-body')
    phdr?.addEventListener('click', () => {
      const collapsed = pbody.classList.toggle('collapsed')
      phdr.classList.toggle('collapsed', collapsed)
    })

    // Populate examples
    const container = document.getElementById('nav-examples-body')
    if (!container) return
    container.innerHTML = ''
    for (const ex of EXAMPLES) {
      const row = document.createElement('div')
      row.className = 'ex-row'
      row.dataset.name = ex.name
      row.innerHTML = `<span class="ex-icon">◈</span><span class="ex-name" title="${ex.description}">${ex.name}</span>`
      row.addEventListener('click', () => this._loadExample(ex))
      container.appendChild(row)
    }
  }

  _addProjectToNav(name) {
    const body = document.getElementById('nav-projects-body')
    if (!body) return
    // Remove empty hint
    body.querySelector('.nav-empty')?.remove()
    // Don't duplicate
    if (body.querySelector(`[data-project="${name}"]`)) return
    const row = document.createElement('div')
    row.className = 'ex-row active'
    row.dataset.project = name
    row.innerHTML = `<span class="ex-icon">◉</span><span class="ex-name">${name}</span>`
    body.appendChild(row)
  }

  // ── Drop zone ───────────────────────────────────────────────────────────────

  _bindDrop() {
    const sidebar = document.getElementById('sidebar')
    if (!sidebar) return

    sidebar.addEventListener('dragover', e => { e.preventDefault(); sidebar.classList.add('drag-over') })
    sidebar.addEventListener('dragleave', () => sidebar.classList.remove('drag-over'))
    sidebar.addEventListener('drop', e => {
      e.preventDefault()
      sidebar.classList.remove('drag-over')
      const file = e.dataTransfer?.files?.[0]
      if (file?.name.endsWith('.zip')) this.loadPackage(file)
    })

    // Global drop
    document.body.addEventListener('dragover', e => e.preventDefault())
    document.body.addEventListener('drop', e => {
      e.preventDefault()
      const file = e.dataTransfer?.files?.[0]
      if (file?.name.endsWith('.zip')) this.loadPackage(file)
    })

    this._bindDropZone()
  }

  _bindDropZone() {
    document.getElementById('drop-zone')?.addEventListener('click', () => {
      document.getElementById('file-input')?.click()
    })
  }

  // ── Canvas controls ─────────────────────────────────────────────────────────

  _bindCanvasControls() {
    document.getElementById('btn-pause')?.addEventListener('click', () => {
      this._paused = !this._paused
      const btn = document.getElementById('btn-pause')
      btn.textContent = this._paused ? '▶' : '⏸'
      btn.classList.toggle('active', this._paused)
      btn.title = this._paused ? 'Resume' : 'Pause'
      if (this.preview) this.preview._clock[this._paused ? 'stop' : 'start']?.()
    })

    const fsBtn = document.getElementById('btn-fullscreen')
    fsBtn?.addEventListener('click', () => {
      const el = document.getElementById('canvas-container')
      const isFs = document.fullscreenElement || document.webkitFullscreenElement
      if (!isFs) {
        if (el?.requestFullscreen) el.requestFullscreen()
        else el?.webkitRequestFullscreen?.()
      } else {
        if (document.exitFullscreen) document.exitFullscreen()
        else document.webkitExitFullscreen?.()
      }
    })
    const onFsChange = () => {
      const isFs = document.fullscreenElement || document.webkitFullscreenElement
      fsBtn?.classList.toggle('active', !!isFs)
    }
    document.addEventListener('fullscreenchange', onFsChange)
    document.addEventListener('webkitfullscreenchange', onFsChange)
  }

  // ── Tutorial pane ────────────────────────────────────────────────────────────

  _initTutorial() {
    this._tut = new TutorialMgr(this)
  }

  // ── FPS counter ─────────────────────────────────────────────────────────────

  _fpsLoop() {
    requestAnimationFrame(() => this._fpsLoop())
    const now = performance.now()
    this._fpsSamples.push(now)
    // Keep only last 60 frames
    while (this._fpsSamples.length > 60) this._fpsSamples.shift()

    if (now - this._lastFpsTs > 500) {
      this._lastFpsTs = now
      const el = document.getElementById('fps-counter')
      if (!el) return
      if (this._fpsSamples.length < 2) { el.textContent = '— fps'; el.className = ''; return }
      const dt = (this._fpsSamples[this._fpsSamples.length-1] - this._fpsSamples[0]) / (this._fpsSamples.length - 1)
      const fps = Math.round(1000 / dt)
      el.textContent = `${fps} fps`
      el.className = fps >= 50 ? 'ok' : fps >= 30 ? 'warn' : 'bad'
    }
  }
}

// ── Tutorial pane manager ─────────────────────────────────────────────────────

class TutorialMgr {
  constructor(ide) {
    this._ide     = ide   // IDE instance — for editor + monaco access
    this._data    = null
    this._ex      = null  // current example {name, entry}
    this._pageIdx = 0
    this._decorations = null
    this._pane    = document.getElementById('tutorial-pane')
    this._crumb   = document.getElementById('tut-breadcrumb')
    this._body    = document.getElementById('tut-body')
    this._btnUp   = document.getElementById('tut-up')
    this._btnPrev = document.getElementById('tut-prev')
    this._btnNext = document.getElementById('tut-next')
    this._btnClose = document.getElementById('tut-close')

    this._btnUp.addEventListener('click',    () => this._goUp())
    this._btnPrev.addEventListener('click',  () => this._goPrev())
    this._btnNext.addEventListener('click',  () => this._goNext())
    this._btnClose.addEventListener('click', () => this.close())

    document.addEventListener('keydown', e => {
      if (!this._pane?.classList.contains('open')) return
      if (e.key === 'ArrowRight' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); this._goNext() }
      if (e.key === 'ArrowLeft'  && !e.ctrlKey && !e.metaKey) { e.preventDefault(); this._goPrev() }
      if (e.key === 'u' || e.key === 'U') this._goUp()
      if (e.key === 'Escape') this.close()
    })
  }

  async tryLoad(ex) {
    this._ex = ex
    this._data = null
    this._pageIdx = 0
    this._clearHighlight()
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}examples/${ex.name}/tutorial.json`)
      if (!res.ok) { this.close(); return }
      this._data = await res.json()
      this._render()
      this._pane.classList.add('open')
    } catch {
      this.close()
    }
  }

  close() {
    this._pane?.classList.remove('open')
    this._data = null
    this._clearHighlight()
  }

  _goNext() {
    if (!this._data || this._pageIdx >= this._data.pages.length - 1) return
    this._pageIdx++
    this._render()
  }

  _goPrev() {
    if (!this._data || this._pageIdx <= 0) return
    this._pageIdx--
    this._render()
  }

  _goUp() {
    if (!this._data) return
    const cur = this._data.pages[this._pageIdx]
    if (!cur.parent) return
    const idx = this._data.pages.findIndex(p => p.id === cur.parent)
    if (idx >= 0) { this._pageIdx = idx; this._render() }
  }

  _render() {
    if (!this._data) return
    const pages = this._data.pages
    const page  = pages[this._pageIdx]

    // Breadcrumb: build full ancestry path
    const crumbParts = []
    let cur = page
    while (cur) {
      crumbParts.unshift(cur.title)
      cur = cur.parent ? pages.find(p => p.id === cur.parent) : null
    }
    this._crumb.textContent = [this._data.title, ...crumbParts].join(' › ')

    // Body content
    this._body.innerHTML = _renderTutBody(page.body || '')

    // Code highlight
    if (page.lines) {
      this._highlight(page.lines[0], page.lines[1])
    } else {
      this._clearHighlight()
    }

    // Nav button state
    this._btnPrev.disabled = this._pageIdx <= 0
    this._btnNext.disabled = this._pageIdx >= pages.length - 1
    this._btnUp.disabled   = !page.parent
  }

  _highlight(startLine, endLine) {
    const ide = this._ide
    if (!ide?.editor || !ide?._monaco) return

    // Ensure the example source file is active in the editor
    if (this._ex) ide.openFile(this._ex.entry)

    const monaco = ide._monaco
    const editor = ide.editor

    this._decorations?.clear()
    this._decorations = editor.createDecorationsCollection([{
      range: new monaco.Range(startLine, 1, endLine, Number.MAX_SAFE_INTEGER),
      options: {
        isWholeLine: true,
        className: 'tut-line-hl',
        linesDecorationsClassName: 'tut-line-gutter',
      },
    }])

    editor.revealLinesInCenter(startLine, endLine)
  }

  _clearHighlight() {
    this._decorations?.clear()
    this._decorations = null
  }
}

function _renderTutBody(text) {
  const lines = text.split('\n')
  let html = ''
  let inCode = false
  let codeBuf = []

  for (const raw of lines) {
    if (raw.startsWith('```')) {
      if (inCode) {
        html += `<pre class="tut-code">${_tutEsc(codeBuf.join('\n'))}</pre>`
        codeBuf = []
        inCode = false
      } else {
        inCode = true
      }
      continue
    }
    if (inCode) { codeBuf.push(raw); continue }

    if (raw.startsWith('# ')) {
      html += `<div class="tut-h1">${_tutEsc(raw.slice(2))}</div>`
    } else if (raw.startsWith('## ')) {
      html += `<div class="tut-h2">${_tutEsc(raw.slice(3))}</div>`
    } else if (raw.startsWith('- ')) {
      html += `<div class="tut-li">· ${_tutEsc(raw.slice(2))}</div>`
    } else if (raw === '') {
      html += '<div class="tut-gap"></div>'
    } else {
      const line = _tutEsc(raw).replace(/`([^`]+)`/g, (_, c) =>
        `<span class="tut-inline">${c}</span>`)
      html += `<div class="tut-p">${line}</div>`
    }
  }

  if (inCode && codeBuf.length) {
    html += `<pre class="tut-code">${_tutEsc(codeBuf.join('\n'))}</pre>`
  }

  return html
}

function _tutEsc(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}
