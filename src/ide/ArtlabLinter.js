/**
 * ArtlabLinter — static analysis for Artlab example code.
 *
 * Validates JavaScript source before execution, catching:
 *  - Import specifiers that won't resolve at runtime
 *  - ctx API calls that don't exist
 *  - Three.js class names that are misspelled or unknown
 *  - Tone.js class names that are misspelled or unknown
 *  - Missing new keyword on class constructors
 *  - Missing / malformed export structure
 *  - Common runtime pitfalls (module-level side effects, missing teardown)
 *
 * Returns an array of diagnostic objects compatible with IDE._setErrors().
 */

// ── Artlab ctx API ─────────────────────────────────────────────────────────────

const CTX_METHODS = new Set([
  'add', 'remove',
  'sphere', 'box', 'cylinder', 'torus', 'plane', 'ring', 'cone', 'mesh',
  'ambient', 'point', 'directional', 'spot', 'hemisphere',
  'lerp', 'clamp', 'map', 'smoothstep', 'rad', 'deg',
  'vec2', 'vec3', 'vec4', 'color', 'quat', 'range',
  'loadTexture', 'setBloom',
])

const CTX_PROPS = new Set([
  'Three', 'scene', 'camera', 'renderer', 'controls', 'labelRenderer', 'elapsed',
])

// ── Three.js public API ────────────────────────────────────────────────────────

const THREE_KNOWN = new Set([
  // Math primitives
  'Vector2','Vector3','Vector4','Quaternion','Euler','Color',
  'Matrix3','Matrix4','Box2','Box3','Sphere','Plane','Ray','Triangle','Line3','Frustum',
  'MathUtils','SphericalHarmonics3','Cylindrical','Spherical',
  // Core scene graph
  'Object3D','Group','Scene',
  'BufferGeometry','BufferAttribute','InterleavedBuffer','InterleavedBufferAttribute',
  'InstancedMesh','InstancedBufferGeometry','InstancedBufferAttribute',
  'LOD','Skeleton','Bone','SkinnedMesh',
  // Geometries
  'BoxGeometry','SphereGeometry','CylinderGeometry','ConeGeometry','PlaneGeometry',
  'TorusGeometry','TorusKnotGeometry','RingGeometry','CircleGeometry','CapsuleGeometry',
  'DodecahedronGeometry','IcosahedronGeometry','OctahedronGeometry','TetrahedronGeometry',
  'TubeGeometry','LatheGeometry','PolyhedronGeometry','ExtrudeGeometry','ShapeGeometry',
  'WireframeGeometry','EdgesGeometry',
  // Materials
  'MeshStandardMaterial','MeshBasicMaterial','MeshPhongMaterial','MeshLambertMaterial',
  'MeshPhysicalMaterial','MeshDepthMaterial','MeshNormalMaterial','MeshMatcapMaterial',
  'MeshToonMaterial','MeshDistanceMaterial',
  'ShaderMaterial','RawShaderMaterial','SpriteMaterial',
  'PointsMaterial','LineBasicMaterial','LineDashedMaterial','Material',
  // Objects
  'Mesh','Points','Line','LineSegments','LineLoop','Sprite',
  // Lights
  'AmbientLight','DirectionalLight','PointLight','SpotLight','HemisphereLight',
  'RectAreaLight','LightProbe','AmbientLightProbe','HemisphereLightProbe',
  // Cameras
  'PerspectiveCamera','OrthographicCamera','Camera','CubeCamera','StereoCamera',
  // Textures & loaders
  'Texture','CubeTexture','DataTexture','Data3DTexture','CompressedTexture',
  'CanvasTexture','VideoTexture','DepthTexture','FramebufferTexture',
  'TextureLoader','CubeTextureLoader','ImageLoader','FileLoader','Loader',
  'ObjectLoader','MaterialLoader','ImageBitmapLoader',
  // Renderers & targets
  'WebGLRenderer','WebGLRenderTarget','WebGLCubeRenderTarget',
  'WebGLArrayRenderTarget','WebGL3DRenderTarget',
  // Animation
  'AnimationMixer','AnimationClip','AnimationAction','AnimationObjectGroup',
  'NumberKeyframeTrack','VectorKeyframeTrack','QuaternionKeyframeTrack',
  'BooleanKeyframeTrack','StringKeyframeTrack','ColorKeyframeTrack',
  // Helpers
  'GridHelper','AxesHelper','ArrowHelper','BoxHelper','Box3Helper',
  'CameraHelper','DirectionalLightHelper','HemisphereLightHelper',
  'PointLightHelper','SpotLightHelper','SkeletonHelper','PlaneHelper',
  // Misc
  'Raycaster','Clock','EventDispatcher','Shape','ShapePath','Path',
  'Font','PMREMGenerator','Fog','FogExp2',
  // Constants accessed as Three.XXX
  'SRGBColorSpace','LinearSRGBColorSpace','NoColorSpace','DisplayP3ColorSpace',
  'PCFSoftShadowMap','BasicShadowMap','PCFShadowMap','VSMShadowMap',
  'ACESFilmicToneMapping','LinearToneMapping','NoToneMapping','ReinhardToneMapping',
  'CineonToneMapping','AgXToneMapping','NeutralToneMapping','CustomToneMapping',
  'DoubleSide','FrontSide','BackSide',
  'AdditiveBlending','SubtractiveBlending','MultiplyBlending','NormalBlending','NoBlending',
  'RepeatWrapping','ClampToEdgeWrapping','MirroredRepeatWrapping',
  'NearestFilter','LinearFilter','LinearMipmapLinearFilter',
  'NearestMipmapNearestFilter','NearestMipmapLinearFilter','LinearMipmapNearestFilter',
  'FloatType','HalfFloatType','UnsignedByteType','ByteType',
  'RGBAFormat','RGBFormat','RedFormat','RGFormat',
  'StaticDrawUsage','DynamicDrawUsage',
])

// Three.js static-method namespaces (not constructors — don't warn about missing new)
const THREE_STATIC_NS = new Set(['MathUtils'])

// ── Tone.js public API ─────────────────────────────────────────────────────────

const TONE_KNOWN = new Set([
  // Synths
  'Synth','PolySynth','MonoSynth','FMSynth','AMSynth','DuoSynth',
  'NoiseSynth','MetalSynth','MembraneSynth','PluckSynth','Sampler',
  // Oscillators / sources
  'Oscillator','OmniOscillator','AMOscillator','FMOscillator','FatOscillator',
  'PWMOscillator','PulseOscillator','Noise','LFO','ToneOscillatorNode',
  // Effects
  'Reverb','FeedbackDelay','PingPongDelay','Chorus','Phaser','Tremolo','Vibrato',
  'Distortion','BitCrusher','Chebyshev','JCReverb','Freeverb',
  'AutoFilter','AutoPanner','AutoWah','Compressor','MultibandCompressor',
  'MidSideCompressor','MidSideSplit','MidSideMerge','StereoWidener',
  'Convolver','Cabinet','Limiter','Gate','FrequencyShifter','PitchShift',
  // Routing / utility
  'Volume','Gain','Panner','CrossFade','Channel','Merge','Split',
  'Add','Abs','Multiply','Subtract','Scale','ScaleExp','WaveShaper',
  'Follower','Recorder',
  // Analysis
  'FFT','Meter','Analyser','Waveform','DCMeter',
  // Sequencing
  'Sequence','Pattern','Part','Loop','ToneEvent','Draw',
  // Playback
  'Player','Players','Buffer','Buffers','UserMedia',
  // Timing / frequency
  'Transport','Destination','Context','Frequency','Time','Ticks','TransportTime',
  // Top-level functions/objects (used as Tone.start(), Tone.now(), etc.)
  'start','now','connect','disconnect','toDestination',
  'getContext','getDestination','getTransport','getDraw',
  'setContext','loaded',
  // Top-level properties
  'context','destination','transport','draw',
])

// ── Import rules ───────────────────────────────────────────────────────────────

const IMPORTMAP_BARE = new Set(['three', 'tone'])

// three/addons paths that are guaranteed present in the vendor bundle
const SAFE_THREE_ADDONS = new Set([
  'three/addons/renderers/CSS2DRenderer.js',
])

// src/ sub-paths that are copied to dist and safe to import at runtime
const SAFE_SRC_PREFIXES = [
  '../../src/stdlib/',
  '../../src/physics/',
  '../../src/audio/',
  '../../src/assets/',
  '../src/stdlib/',
  '../src/physics/',
  '../src/audio/',
  '../src/assets/',
  './','../',
]

// ── Lint entry point ───────────────────────────────────────────────────────────

/**
 * Lint Artlab JavaScript source, returning an array of diagnostics.
 * @param {string} source     — full source text
 * @param {string} [filename] — used in diagnostic file fields
 * @returns {Array<{severity:'error'|'warn'|'info', message:string, file:string, line:number, col:number}>}
 */
export function lint(source, filename = 'script.js') {
  // Test files are not Artlab entry points — skip all checks
  if (filename.endsWith('.test.js') || filename.endsWith('.spec.js')) return []

  const diags = []
  const lines = source.split('\n')

  function push(severity, lineIdx, col, message) {
    diags.push({ severity, message, file: filename, line: lineIdx + 1, col: col + 1 })
  }

  _checkExports(source, push)
  _checkTeardown(source, push)

  // Strip block comments before line analysis (simple, non-nested)
  const stripped = _stripBlockComments(source).split('\n')

  for (let i = 0; i < stripped.length; i++) {
    const raw = stripped[i]
    // Remove inline line comments for analysis, but keep original for column offsets
    const noComment = raw.replace(/\/\/.*$/, '')
    if (!noComment.trim()) continue

    _checkImports(noComment, i, push)
    _checkCtxCalls(noComment, i, push)
    _checkThreeAPI(noComment, i, push)
    _checkToneAPI(noComment, i, push)
  }

  return diags
}

// ── Validators ────────────────────────────────────────────────────────────────

function _checkExports(source, push) {
  const hasSetup    = /export\s+(async\s+)?function\s+setup\b/.test(source)    || /export\s+const\s+setup\s*=/.test(source)
  const hasUpdate   = /export\s+(async\s+)?function\s+update\b/.test(source)   || /export\s+const\s+update\s*=/.test(source)
  const hasTeardown = /export\s+(async\s+)?function\s+teardown\b/.test(source) || /export\s+const\s+teardown\s*=/.test(source)

  // Only flag missing setup() when the file already declares other Artlab
  // lifecycle hooks (update/teardown). Helper modules that pass ctx as a
  // parameter to utility functions are exempt — they're not entry points.
  if (!hasSetup && (hasUpdate || hasTeardown)) {
    push('warn', 0, 0,
      "No setup(ctx) function exported. Every Artlab example must export at least: export function setup(ctx) { ... }")
  }
}

function _checkTeardown(source, push) {
  // Warn if addEventListener is used but no teardown is exported
  const hasListener = /addEventListener\s*\(/.test(source)
  const hasTeardown =
    /export\s+(async\s+)?function\s+teardown\b/.test(source) ||
    /export\s+const\s+teardown\s*=/.test(source)
  if (hasListener && !hasTeardown) {
    push('warn', 0, 0,
      "addEventListener used without a teardown() export — event listeners will leak when the example reloads. Export teardown(ctx) and call removeEventListener.")
  }
}

function _checkImports(line, i, push) {
  // Match: import ... from 'specifier'  or  import('specifier')
  const staticRe = /\bfrom\s+['"]([^'"]+)['"]/g
  const dynamicRe = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g

  for (const re of [staticRe, dynamicRe]) {
    let m
    while ((m = re.exec(line)) !== null) {
      const spec = m[1]
      const col  = m.index

      // Relative imports
      if (spec.startsWith('.')) {
        // Warn about importing from src/audio or src/assets directly —
        // those are available in dist but have a complex dependency chain.
        // (Informational only — they do work now that vite.config copies them.)
        continue
      }

      // three/addons/ prefix
      if (spec.startsWith('three/addons/')) {
        if (!SAFE_THREE_ADDONS.has(spec)) {
          push('warn', i, col,
            `'${spec}': only 'three/addons/renderers/CSS2DRenderer.js' is in the vendor bundle. ` +
            `Wrap this import in try { } catch { } so the example degrades gracefully if the file is absent.`)
        }
        continue
      }

      // Bare specifiers must be in importmap
      if (!IMPORTMAP_BARE.has(spec)) {
        push('error', i, col,
          `Cannot import '${spec}' — bare specifier not in importmap. ` +
          `Only 'three' and 'tone' are available. Use a relative path (../../src/...) for local modules.`)
      }
    }
  }
}

function _checkCtxCalls(line, i, push) {
  // Only check ctx.name( — method-call form, not property reads
  const re = /\bctx\.([a-zA-Z][a-zA-Z0-9]*)\s*\(/g
  let m
  while ((m = re.exec(line)) !== null) {
    const name = m[1]
    if (CTX_METHODS.has(name)) continue
    // Ignore private/internal convention
    if (name.startsWith('_')) continue
    push('warn', i, m.index,
      `ctx.${name}() is not an Artlab API method. ` +
      `Valid methods: ${[...CTX_METHODS].sort().join(', ')}.`)
  }
}

function _checkThreeAPI(line, i, push) {
  // Check: Three.Name or ctx.Three.Name
  const memberRe = /\bThree\.([A-Z][a-zA-Z0-9_]*)\b/g
  let m
  while ((m = memberRe.exec(line)) !== null) {
    const name = m[1]
    if (THREE_KNOWN.has(name)) continue
    push('warn', i, m.index,
      `Three.${name} is not a recognised Three.js export. Check spelling — ` +
      `it may be a typo or a class not present in three.module.min.js.`)
  }

  // Check for missing `new` before Three.UpperCaseConstructor(
  // Pattern: Three.Name( without a preceding `new`
  // We skip known static namespaces (MathUtils) and anything after a `.` (chained calls)
  const noNewRe = /(?<![.`])(?<!\bnew\s{0,10})\bThree\.([A-Z][a-zA-Z0-9]+)\s*\(/g
  while ((m = noNewRe.exec(line)) !== null) {
    const name = m[1]
    if (THREE_STATIC_NS.has(name)) continue
    // Heuristic: if preceded by `new` anywhere on the line before this match, skip
    const before = line.slice(0, m.index)
    if (/\bnew\s*$/.test(before.trimEnd())) continue
    // Skip if it's immediately after a `.` — static method on an instance
    if (/\.\s*$/.test(before)) continue
    push('warn', i, m.index,
      `Missing 'new' before Three.${name}(...). Three.js classes are constructors and require 'new'.`)
  }
}

function _checkToneAPI(line, i, push) {
  const re = /\bTone\.([A-Za-z][a-zA-Z0-9_]*)\b/g
  let m
  while ((m = re.exec(line)) !== null) {
    const name = m[1]
    if (TONE_KNOWN.has(name)) continue
    push('warn', i, m.index,
      `Tone.${name} is not a recognised Tone.js export. Check spelling.`)
  }
}

// ── Utilities ──────────────────────────────────────────────────────────────────

function _stripBlockComments(src) {
  // Replace /* ... */ (including multi-line) with whitespace to preserve line numbers
  return src.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
}

// ── Three.js type declarations for Monaco autocomplete ─────────────────────────
// Exported so IDE.js can inject them as an extra Monaco lib.

export const THREE_TYPES_DTS = `
declare namespace THREE {
  // ── Math ──────────────────────────────────────────────────────────────────
  class Vector2 {
    constructor(x?: number, y?: number);
    x: number; y: number;
    set(x: number, y: number): this;
    clone(): Vector2; copy(v: Vector2): this;
    add(v: Vector2): this; sub(v: Vector2): this;
    multiplyScalar(s: number): this; length(): number;
    normalize(): this; dot(v: Vector2): number;
    distanceTo(v: Vector2): number;
  }
  class Vector3 {
    constructor(x?: number, y?: number, z?: number);
    x: number; y: number; z: number;
    set(x: number, y: number, z: number): this;
    clone(): Vector3; copy(v: Vector3): this;
    add(v: Vector3): this; sub(v: Vector3): this; addScaledVector(v: Vector3, s: number): this;
    multiplyScalar(s: number): this; divideScalar(s: number): this;
    length(): number; lengthSq(): number;
    normalize(): this; negate(): this;
    dot(v: Vector3): number; cross(v: Vector3): this; crossVectors(a: Vector3, b: Vector3): this;
    distanceTo(v: Vector3): number; distanceToSquared(v: Vector3): number;
    lerpVectors(v1: Vector3, v2: Vector3, t: number): this; lerp(v: Vector3, t: number): this;
    applyMatrix4(m: Matrix4): this; applyQuaternion(q: Quaternion): this;
    getWorldPosition(target: Vector3): Vector3;
    setFromMatrixPosition(m: Matrix4): this;
  }
  class Vector4 {
    constructor(x?: number, y?: number, z?: number, w?: number);
    x: number; y: number; z: number; w: number;
    set(x: number, y: number, z: number, w: number): this;
    clone(): Vector4;
  }
  class Quaternion {
    constructor(x?: number, y?: number, z?: number, w?: number);
    x: number; y: number; z: number; w: number;
    set(x: number, y: number, z: number, w: number): this;
    clone(): Quaternion; copy(q: Quaternion): this;
    setFromEuler(e: Euler): this; setFromAxisAngle(axis: Vector3, angle: number): this;
    multiply(q: Quaternion): this; slerp(q: Quaternion, t: number): this;
    normalize(): this; invert(): this;
  }
  class Euler {
    constructor(x?: number, y?: number, z?: number, order?: string);
    x: number; y: number; z: number; order: string;
    set(x: number, y: number, z: number, order?: string): this;
    clone(): Euler;
  }
  class Color {
    constructor(r?: number | string | Color, g?: number, b?: number);
    r: number; g: number; b: number;
    set(color: number | string | Color): this;
    setHex(hex: number): this; setHSL(h: number, s: number, l: number): this;
    setRGB(r: number, g: number, b: number): this;
    getHex(): number; getHexString(): string;
    clone(): Color; copy(c: Color): this;
    lerp(color: Color, t: number): this;
    multiplyScalar(s: number): this;
  }
  class Matrix4 {
    constructor();
    elements: number[];
    identity(): this; copy(m: Matrix4): this; clone(): Matrix4;
    makeTranslation(x: number, y: number, z: number): this;
    makeRotationX(theta: number): this; makeRotationY(theta: number): this; makeRotationZ(theta: number): this;
    makeScale(x: number, y: number, z: number): this;
    compose(position: Vector3, quaternion: Quaternion, scale: Vector3): this;
    decompose(position: Vector3, quaternion: Quaternion, scale: Vector3): this;
    multiply(m: Matrix4): this; premultiply(m: Matrix4): this;
    setPosition(v: Vector3 | number, y?: number, z?: number): this;
  }
  namespace MathUtils {
    function degToRad(degrees: number): number;
    function radToDeg(radians: number): number;
    function clamp(value: number, min: number, max: number): number;
    function lerp(x: number, y: number, t: number): number;
    function smoothstep(x: number, min: number, max: number): number;
    function randFloat(low: number, high: number): number;
    function randInt(low: number, high: number): number;
    function mapLinear(x: number, a1: number, a2: number, b1: number, b2: number): number;
    function generateUUID(): string;
  }
  // ── Core ───────────────────────────────────────────────────────────────────
  class Object3D {
    position: Vector3; rotation: Euler; quaternion: Quaternion; scale: Vector3;
    up: Vector3; matrix: Matrix4; matrixWorld: Matrix4;
    visible: boolean; castShadow: boolean; receiveShadow: boolean;
    renderOrder: number; frustumCulled: boolean;
    name: string; uuid: string; id: number; type: string;
    parent: Object3D | null; children: Object3D[];
    userData: Record<string, any>;
    add(...objects: Object3D[]): this; remove(...objects: Object3D[]): this;
    lookAt(v: Vector3 | number, y?: number, z?: number): void;
    traverse(cb: (obj: Object3D) => void): void;
    clone(recursive?: boolean): this;
    updateMatrix(): void; updateMatrixWorld(force?: boolean): void;
    getWorldPosition(target: Vector3): Vector3;
    getWorldQuaternion(target: Quaternion): Quaternion;
    getWorldScale(target: Vector3): Vector3;
    rotateX(angle: number): this; rotateY(angle: number): this; rotateZ(angle: number): this;
    translateX(distance: number): this; translateY(distance: number): this; translateZ(distance: number): this;
  }
  class Group extends Object3D { constructor(); type: 'Group'; }
  class Scene extends Object3D {
    constructor();
    background: Color | Texture | null;
    fog: Fog | FogExp2 | null;
    environment: Texture | null;
    overrideMaterial: Material | null;
  }
  // ── Buffer Geometry ────────────────────────────────────────────────────────
  class BufferAttribute {
    constructor(array: ArrayLike<number>, itemSize: number, normalized?: boolean);
    array: ArrayLike<number>; itemSize: number; count: number;
    needsUpdate: boolean;
    getX(index: number): number; getY(index: number): number; getZ(index: number): number;
    setXY(index: number, x: number, y: number): this;
    setXYZ(index: number, x: number, y: number, z: number): this;
    setXYZW(index: number, x: number, y: number, z: number, w: number): this;
  }
  class BufferGeometry {
    constructor();
    attributes: Record<string, BufferAttribute>;
    index: BufferAttribute | null;
    drawRange: { start: number; count: number };
    setAttribute(name: string, attribute: BufferAttribute): this;
    getAttribute(name: string): BufferAttribute;
    setIndex(index: BufferAttribute | number[]): this;
    setFromPoints(points: Vector3[] | Vector2[]): this;
    computeVertexNormals(): void; computeBoundingSphere(): void;
    dispose(): void; clone(): BufferGeometry;
    boundingSphere: { radius: number } | null;
  }
  class InstancedBufferGeometry extends BufferGeometry { instanceCount: number; }
  // ── Primitive Geometries ───────────────────────────────────────────────────
  class BoxGeometry extends BufferGeometry { constructor(w?: number, h?: number, d?: number, ws?: number, hs?: number, ds?: number); }
  class SphereGeometry extends BufferGeometry { constructor(radius?: number, widthSegs?: number, heightSegs?: number, phiStart?: number, phiLen?: number, thetaStart?: number, thetaLen?: number); }
  class CylinderGeometry extends BufferGeometry { constructor(rTop?: number, rBottom?: number, height?: number, radialSegs?: number, heightSegs?: number, openEnded?: boolean); }
  class ConeGeometry extends BufferGeometry { constructor(radius?: number, height?: number, radialSegs?: number, heightSegs?: number, openEnded?: boolean); }
  class PlaneGeometry extends BufferGeometry { constructor(w?: number, h?: number, wSegs?: number, hSegs?: number); }
  class TorusGeometry extends BufferGeometry { constructor(radius?: number, tube?: number, radialSegs?: number, tubularSegs?: number, arc?: number); }
  class TorusKnotGeometry extends BufferGeometry { constructor(radius?: number, tube?: number, tubularSegs?: number, radialSegs?: number, p?: number, q?: number); }
  class RingGeometry extends BufferGeometry { constructor(innerRadius?: number, outerRadius?: number, thetaSegs?: number, phiSegs?: number, thetaStart?: number, thetaLength?: number); }
  class CircleGeometry extends BufferGeometry { constructor(radius?: number, segments?: number, thetaStart?: number, thetaLength?: number); }
  class IcosahedronGeometry extends BufferGeometry { constructor(radius?: number, detail?: number); }
  class OctahedronGeometry extends BufferGeometry { constructor(radius?: number, detail?: number); }
  class TetrahedronGeometry extends BufferGeometry { constructor(radius?: number, detail?: number); }
  class DodecahedronGeometry extends BufferGeometry { constructor(radius?: number, detail?: number); }
  class TubeGeometry extends BufferGeometry { constructor(path: any, tubularSegments?: number, radius?: number, radialSegments?: number, closed?: boolean); }
  class CapsuleGeometry extends BufferGeometry { constructor(radius?: number, length?: number, capSubdivisions?: number, radialSegments?: number); }
  class WireframeGeometry extends BufferGeometry { constructor(geometry: BufferGeometry); }
  class EdgesGeometry extends BufferGeometry { constructor(geometry: BufferGeometry, thresholdAngle?: number); }
  class InstancedMesh extends Mesh {
    constructor(geometry: BufferGeometry, material: Material | Material[], count: number);
    count: number;
    instanceMatrix: BufferAttribute;
    instanceColor: BufferAttribute | null;
    getMatrixAt(index: number, matrix: Matrix4): void;
    setMatrixAt(index: number, matrix: Matrix4): void;
    getColorAt(index: number, color: Color): void;
    setColorAt(index: number, color: Color): void;
  }
  class LOD extends Object3D {
    constructor();
    levels: Array<{ distance: number; object: Object3D }>;
    addLevel(object: Object3D, distance?: number, hysteresis?: number): this;
    getCurrentLevel(): number;
    update(camera: Camera): void;
  }
  // ── Materials ──────────────────────────────────────────────────────────────
  interface MaterialParams {
    color?: number | string | Color; opacity?: number; transparent?: boolean;
    wireframe?: boolean; side?: number; depthTest?: boolean; depthWrite?: boolean;
    blending?: number; visible?: boolean; vertexColors?: boolean;
    polygonOffset?: boolean; polygonOffsetFactor?: number; polygonOffsetUnits?: number;
  }
  interface StandardMaterialParams extends MaterialParams {
    roughness?: number; metalness?: number;
    emissive?: number | string | Color; emissiveIntensity?: number;
    map?: Texture | null; normalMap?: Texture | null;
    roughnessMap?: Texture | null; metalnessMap?: Texture | null;
    emissiveMap?: Texture | null; aoMap?: Texture | null;
    envMap?: Texture | null; envMapIntensity?: number;
  }
  class Material {
    opacity: number; transparent: boolean; side: number; visible: boolean;
    blending: number; depthWrite: boolean; depthTest: boolean; wireframe: boolean;
    needsUpdate: boolean;
    dispose(): void; clone(): this; copy(m: Material): this;
  }
  class MeshStandardMaterial extends Material {
    constructor(params?: StandardMaterialParams);
    color: Color; roughness: number; metalness: number;
    emissive: Color; emissiveIntensity: number;
    map: Texture | null; normalMap: Texture | null;
    roughnessMap: Texture | null; metalnessMap: Texture | null;
    emissiveMap: Texture | null; envMap: Texture | null; envMapIntensity: number;
  }
  class MeshPhysicalMaterial extends MeshStandardMaterial {
    constructor(params?: StandardMaterialParams & { clearcoat?: number; clearcoatRoughness?: number; transmission?: number; ior?: number; thickness?: number });
    clearcoat: number; clearcoatRoughness: number; transmission: number; ior: number;
  }
  class MeshBasicMaterial extends Material {
    constructor(params?: MaterialParams & { map?: Texture | null; color?: number | string | Color });
    color: Color; map: Texture | null;
  }
  class MeshLambertMaterial extends Material {
    constructor(params?: MaterialParams & { color?: number | string | Color; emissive?: number | string | Color; map?: Texture | null });
    color: Color; emissive: Color; map: Texture | null;
  }
  class MeshPhongMaterial extends Material {
    constructor(params?: MaterialParams & { color?: number | string | Color; emissive?: number | string | Color; shininess?: number; specular?: number | string | Color; map?: Texture | null });
    color: Color; emissive: Color; specular: Color; shininess: number;
  }
  class MeshNormalMaterial extends Material { constructor(params?: MaterialParams); }
  class MeshDepthMaterial extends Material { constructor(params?: MaterialParams); }
  class MeshMatcapMaterial extends Material {
    constructor(params?: MaterialParams & { matcap?: Texture | null; color?: number | string });
  }
  class ShaderMaterial extends Material {
    constructor(params?: { uniforms?: Record<string, { value: any }>; vertexShader?: string; fragmentShader?: string; transparent?: boolean; side?: number; blending?: number; depthWrite?: boolean; defines?: Record<string, any>; glslVersion?: string });
    uniforms: Record<string, { value: any }>;
    vertexShader: string; fragmentShader: string;
    defines: Record<string, any>;
  }
  class RawShaderMaterial extends ShaderMaterial { constructor(params?: ConstructorParameters<typeof ShaderMaterial>[0]); }
  class PointsMaterial extends Material {
    constructor(params?: MaterialParams & { size?: number; sizeAttenuation?: boolean; map?: Texture | null; alphaMap?: Texture | null; color?: number | string | Color });
    color: Color; size: number; sizeAttenuation: boolean; map: Texture | null;
  }
  class LineBasicMaterial extends Material {
    constructor(params?: MaterialParams & { color?: number | string | Color; linewidth?: number });
    color: Color; linewidth: number;
  }
  class LineDashedMaterial extends LineBasicMaterial {
    constructor(params?: ConstructorParameters<typeof LineBasicMaterial>[0] & { dashSize?: number; gapSize?: number; scale?: number });
    dashSize: number; gapSize: number; scale: number;
  }
  class SpriteMaterial extends Material {
    constructor(params?: MaterialParams & { map?: Texture | null; color?: number | string | Color; sizeAttenuation?: boolean });
    color: Color; map: Texture | null; sizeAttenuation: boolean; rotation: number;
  }
  // ── Objects ────────────────────────────────────────────────────────────────
  class Mesh extends Object3D {
    constructor(geometry?: BufferGeometry, material?: Material | Material[]);
    geometry: BufferGeometry; material: Material | Material[];
    isMesh: boolean;
    updateMorphTargets(): void;
  }
  class Points extends Object3D {
    constructor(geometry?: BufferGeometry, material?: PointsMaterial);
    geometry: BufferGeometry; material: PointsMaterial;
    isPoints: boolean;
  }
  class Line extends Object3D {
    constructor(geometry?: BufferGeometry, material?: LineBasicMaterial | LineDashedMaterial);
    geometry: BufferGeometry; material: LineBasicMaterial;
    isLine: boolean;
  }
  class LineSegments extends Line { constructor(geometry?: BufferGeometry, material?: LineBasicMaterial); isLineSegments: boolean; }
  class LineLoop extends Line { constructor(geometry?: BufferGeometry, material?: LineBasicMaterial); }
  class Sprite extends Object3D { constructor(material?: SpriteMaterial); material: SpriteMaterial; center: Vector2; }
  class SkinnedMesh extends Mesh { constructor(geometry?: BufferGeometry, material?: Material | Material[]); skeleton: Skeleton; bindMode: string; }
  class Skeleton { constructor(bones: Bone[], boneInverses?: Matrix4[]); bones: Bone[]; update(): void; }
  class Bone extends Object3D { isBone: boolean; }
  // ── Lights ─────────────────────────────────────────────────────────────────
  class Light extends Object3D {
    color: Color; intensity: number;
    constructor(color?: number | string | Color, intensity?: number);
  }
  class AmbientLight extends Light { constructor(color?: number | string | Color, intensity?: number); isAmbientLight: boolean; }
  class DirectionalLight extends Light {
    constructor(color?: number | string | Color, intensity?: number);
    target: Object3D;
    shadow: { mapSize: Vector2; camera: any; bias: number; normalBias: number; radius: number };
    castShadow: boolean;
  }
  class PointLight extends Light {
    constructor(color?: number | string | Color, intensity?: number, distance?: number, decay?: number);
    distance: number; decay: number; power: number;
    shadow: { mapSize: Vector2; camera: any; bias: number };
    castShadow: boolean;
  }
  class SpotLight extends Light {
    constructor(color?: number | string | Color, intensity?: number, distance?: number, angle?: number, penumbra?: number, decay?: number);
    target: Object3D; distance: number; angle: number; penumbra: number; decay: number;
    shadow: { mapSize: Vector2; camera: any; bias: number; focus: number };
    castShadow: boolean;
  }
  class HemisphereLight extends Light {
    constructor(skyColor?: number | string | Color, groundColor?: number | string | Color, intensity?: number);
    groundColor: Color;
  }
  class RectAreaLight extends Light {
    constructor(color?: number | string | Color, intensity?: number, width?: number, height?: number);
    width: number; height: number;
  }
  // ── Cameras ────────────────────────────────────────────────────────────────
  class Camera extends Object3D { matrixWorldInverse: Matrix4; projectionMatrix: Matrix4; projectionMatrixInverse: Matrix4; }
  class PerspectiveCamera extends Camera {
    constructor(fov?: number, aspect?: number, near?: number, far?: number);
    fov: number; aspect: number; near: number; far: number; zoom: number;
    focus: number; filmGauge: number; filmOffset: number;
    updateProjectionMatrix(): void;
    setFocalLength(focalLength: number): void;
    getEffectiveFOV(): number;
  }
  class OrthographicCamera extends Camera {
    constructor(left?: number, right?: number, top?: number, bottom?: number, near?: number, far?: number);
    left: number; right: number; top: number; bottom: number; near: number; far: number; zoom: number;
    updateProjectionMatrix(): void;
  }
  // ── Textures ───────────────────────────────────────────────────────────────
  class Texture {
    image: any; uuid: string; name: string;
    wrapS: number; wrapT: number; magFilter: number; minFilter: number;
    anisotropy: number; colorSpace: string; flipY: boolean;
    needsUpdate: boolean; repeat: Vector2; offset: Vector2; center: Vector2;
    rotation: number; matrixAutoUpdate: boolean;
    dispose(): void; clone(): Texture;
  }
  class CanvasTexture extends Texture { constructor(canvas: HTMLCanvasElement | OffscreenCanvas | ImageBitmap); }
  class VideoTexture extends Texture { constructor(video: HTMLVideoElement); }
  class DataTexture extends Texture { constructor(data: ArrayBufferView, width: number, height: number, format?: number, type?: number); }
  class TextureLoader { constructor(manager?: any); load(url: string, onLoad?: (t: Texture) => void, onProgress?: (e: ProgressEvent) => void, onError?: (e: ErrorEvent) => void): Texture; loadAsync(url: string): Promise<Texture>; }
  // ── Raycasting ────────────────────────────────────────────────────────────
  interface Intersection { distance: number; point: Vector3; face: any | null; faceIndex: number | null; object: Object3D; uv: Vector2 | null; instanceId: number | undefined; }
  class Raycaster {
    constructor(origin?: Vector3, direction?: Vector3, near?: number, far?: number);
    ray: { origin: Vector3; direction: Vector3 };
    near: number; far: number; camera: Camera;
    params: { Points: { threshold: number }; Line: { threshold: number } };
    set(origin: Vector3, direction: Vector3): void;
    setFromCamera(coords: Vector2, camera: Camera): void;
    intersectObject(object: Object3D, recursive?: boolean, target?: Intersection[]): Intersection[];
    intersectObjects(objects: Object3D[], recursive?: boolean, target?: Intersection[]): Intersection[];
  }
  // ── Clocks & animation ────────────────────────────────────────────────────
  class Clock { constructor(autoStart?: boolean); autoStart: boolean; startTime: number; oldTime: number; elapsedTime: number; running: boolean; start(): void; stop(): void; getElapsedTime(): number; getDelta(): number; }
  class AnimationMixer { constructor(root: Object3D); time: number; timeScale: number; clipAction(clip: AnimationClip, root?: Object3D): AnimationAction; uncacheClip(clip: AnimationClip): void; update(deltaTime: number): void; }
  class AnimationClip { constructor(name?: string, duration?: number, tracks?: any[]); name: string; duration: number; tracks: any[]; static findByName(objectOrClipArray: any, name: string): AnimationClip; }
  class AnimationAction { play(): this; stop(): this; reset(): this; setLoop(mode: number, repetitions: number): this; setDuration(duration: number): this; crossFadeTo(fadeInAction: AnimationAction, duration: number, warp: boolean): this; }
  // ── Fog ───────────────────────────────────────────────────────────────────
  class Fog { constructor(color: number | string | Color, near?: number, far?: number); color: Color; near: number; far: number; }
  class FogExp2 { constructor(color: number | string | Color, density?: number); color: Color; density: number; }
  // ── Helpers ───────────────────────────────────────────────────────────────
  class GridHelper extends Object3D { constructor(size?: number, divisions?: number, color1?: number | string | Color, color2?: number | string | Color); }
  class AxesHelper extends Object3D { constructor(size?: number); }
  class ArrowHelper extends Object3D { constructor(dir: Vector3, origin?: Vector3, length?: number, hex?: number, headLength?: number, headWidth?: number); setColor(color: Color | string | number): void; }
  class BoxHelper extends Object3D { constructor(object?: Object3D, color?: number | string | Color); update(object?: Object3D): void; }
  class CameraHelper extends Object3D { constructor(camera: Camera); }
  class SkeletonHelper extends Object3D { constructor(object: Object3D); bones: Bone[]; }
  // ── Misc ──────────────────────────────────────────────────────────────────
  class PMREMGenerator { constructor(renderer: WebGLRenderer); fromScene(scene: Scene, sigma?: number, near?: number, far?: number): WebGLRenderTarget; fromEquirectangular(texture: Texture, renderTarget?: WebGLRenderTarget): WebGLRenderTarget; compileCubemapShader(): void; compileEquirectangularShader(): void; dispose(): void; }
  class WebGLRenderer {
    constructor(params?: { canvas?: HTMLCanvasElement; antialias?: boolean; alpha?: boolean; powerPreference?: string; precision?: string; stencil?: boolean; depth?: boolean });
    domElement: HTMLCanvasElement;
    shadowMap: { enabled: boolean; type: number };
    toneMapping: number; toneMappingExposure: number;
    outputColorSpace: string;
    setSize(width: number, height: number, updateStyle?: boolean): void;
    setPixelRatio(value: number): void;
    setClearColor(color: number | string | Color, alpha?: number): void;
    render(scene: Scene, camera: Camera): void;
    setRenderTarget(renderTarget: WebGLRenderTarget | null): void;
    getRenderTarget(): WebGLRenderTarget | null;
    getSize(target: Vector2): Vector2;
    getPixelRatio(): number;
    dispose(): void;
    info: { render: { triangles: number; calls: number; frame: number }; memory: { geometries: number; textures: number } };
  }
  class WebGLRenderTarget {
    constructor(width: number, height: number, options?: any);
    width: number; height: number;
    texture: Texture; depthTexture: DepthTexture;
    setSize(width: number, height: number): void;
    dispose(): void; clone(): WebGLRenderTarget;
  }
  class DepthTexture extends Texture { constructor(width: number, height: number, type?: number); }
  // ── Constants ─────────────────────────────────────────────────────────────
  const DoubleSide: number; const FrontSide: number; const BackSide: number;
  const NormalBlending: number; const AdditiveBlending: number; const SubtractiveBlending: number; const MultiplyBlending: number; const NoBlending: number;
  const RepeatWrapping: number; const ClampToEdgeWrapping: number; const MirroredRepeatWrapping: number;
  const NearestFilter: number; const LinearFilter: number;
  const LinearMipmapLinearFilter: number; const NearestMipmapNearestFilter: number;
  const NearestMipmapLinearFilter: number; const LinearMipmapNearestFilter: number;
  const SRGBColorSpace: string; const LinearSRGBColorSpace: string; const NoColorSpace: string;
  const ACESFilmicToneMapping: number; const LinearToneMapping: number; const NoToneMapping: number;
  const ReinhardToneMapping: number; const CineonToneMapping: number; const AgXToneMapping: number;
  const NeutralToneMapping: number; const CustomToneMapping: number;
  const BasicShadowMap: number; const PCFShadowMap: number; const PCFSoftShadowMap: number; const VSMShadowMap: number;
  const StaticDrawUsage: number; const DynamicDrawUsage: number;
  const FloatType: number; const HalfFloatType: number; const UnsignedByteType: number; const ByteType: number;
  const RGBAFormat: number; const RGBFormat: number; const RedFormat: number; const RGFormat: number;
  const UVMapping: number; const CubeReflectionMapping: number; const CubeRefractionMapping: number; const EquirectangularReflectionMapping: number;
}
`

export const TONE_TYPES_DTS = `
declare namespace TONE {
  // Core start
  function start(): Promise<void>;
  function now(): number;
  function loaded(): Promise<void>;
  function getContext(): any;
  function getDestination(): any;
  function getTransport(): Transport;
  // Transport
  const Transport: {
    bpm: { value: number; rampTo(value: number, rampTime?: number): void };
    state: 'started' | 'stopped' | 'paused';
    start(time?: number | string): void;
    stop(time?: number | string): void;
    pause(time?: number | string): void;
    toggle(): void;
    seconds: number;
    position: string;
    loopStart: number | string; loopEnd: number | string; loop: boolean;
  };
  // Synths
  interface EnvelopeParams { attack?: number | string; decay?: number | string; sustain?: number; release?: number | string; }
  interface OscillatorParams { type?: OscillatorType | string; partialCount?: number; }
  interface SynthParams { oscillator?: OscillatorParams; envelope?: EnvelopeParams; volume?: number; }
  class Synth { constructor(options?: SynthParams); volume: { value: number }; connect(node: any): this; toDestination(): this; triggerAttack(note: string | number, time?: any, velocity?: number): this; triggerRelease(time?: any): this; triggerAttackRelease(note: string | number, duration: string | number, time?: any, velocity?: number): this; dispose(): void; }
  class PolySynth { constructor(voice?: any, options?: SynthParams); volume: { value: number }; connect(node: any): this; toDestination(): this; triggerAttack(notes: string | string[] | number[], time?: any, velocity?: number): this; triggerRelease(notes: string | string[] | number[], time?: any): this; releaseAll(time?: any): this; dispose(): void; }
  class MonoSynth extends Synth { }
  class FMSynth extends Synth { harmonicity: { value: number }; modulationIndex: { value: number }; }
  class AMSynth extends Synth { harmonicity: { value: number }; }
  class NoiseSynth { constructor(options?: { noise?: { type?: string }; envelope?: EnvelopeParams; volume?: number }); volume: { value: number }; connect(node: any): this; toDestination(): this; triggerAttack(time?: any, velocity?: number): this; triggerRelease(time?: any): this; triggerAttackRelease(duration: string | number, time?: any, velocity?: number): this; dispose(): void; }
  class MembraneSynth extends Synth { pitchDecay: number; octaves: number; }
  class MetalSynth { constructor(options?: any); connect(node: any): this; toDestination(): this; triggerAttack(time?: any, velocity?: number): this; triggerRelease(time?: any): this; triggerAttackRelease(duration: string | number, time?: any, velocity?: number): this; dispose(): void; }
  class PluckSynth { constructor(options?: any); triggerAttack(note: string | number, time?: any): this; connect(node: any): this; toDestination(): this; dispose(): void; }
  class Sampler { constructor(urls: Record<string, string>, options?: { onload?: () => void; baseUrl?: string; }); triggerAttack(notes: string | string[], time?: any, velocity?: number): this; triggerRelease(notes: string | string[], time?: any): this; triggerAttackRelease(notes: string | string[], duration: string | number, time?: any, velocity?: number): this; connect(node: any): this; toDestination(): this; dispose(): void; }
  // Effects
  class Reverb { constructor(options?: { decay?: number; preDelay?: number }); wet: { value: number }; connect(node: any): this; toDestination(): this; dispose(): void; }
  class FeedbackDelay { constructor(options?: { delayTime?: string | number; feedback?: number; wet?: number }); delayTime: { value: number }; feedback: { value: number }; wet: { value: number }; connect(node: any): this; toDestination(): this; dispose(): void; }
  class PingPongDelay { constructor(options?: { delayTime?: string | number; feedback?: number; wet?: number }); wet: { value: number }; connect(node: any): this; toDestination(): this; dispose(): void; }
  class Chorus { constructor(options?: { frequency?: number; delayTime?: number; depth?: number; wet?: number }); wet: { value: number }; start(): this; connect(node: any): this; toDestination(): this; dispose(): void; }
  class Phaser { constructor(options?: { frequency?: number; octaves?: number; baseFrequency?: number; wet?: number }); wet: { value: number }; connect(node: any): this; toDestination(): this; dispose(): void; }
  class Tremolo { constructor(options?: { frequency?: number; depth?: number; wet?: number }); wet: { value: number }; start(): this; connect(node: any): this; toDestination(): this; dispose(): void; }
  class Vibrato { constructor(options?: { frequency?: number; depth?: number; wet?: number }); wet: { value: number }; connect(node: any): this; toDestination(): this; dispose(): void; }
  class Distortion { constructor(options?: { distortion?: number; wet?: number }); wet: { value: number }; connect(node: any): this; toDestination(): this; dispose(): void; }
  class Compressor { constructor(options?: { threshold?: number; ratio?: number; attack?: number; release?: number; knee?: number }); connect(node: any): this; toDestination(): this; dispose(): void; }
  class Limiter { constructor(threshold?: number); connect(node: any): this; toDestination(): this; dispose(): void; }
  class Volume { constructor(db?: number); volume: { value: number; rampTo(value: number, rampTime: number): void }; connect(node: any): this; toDestination(): this; dispose(): void; }
  class Gain { constructor(gain?: number); gain: { value: number }; connect(node: any): this; toDestination(): this; dispose(): void; }
  // Sequencing
  class Sequence { constructor(callback: (time: any, value: any) => void, events: any[], subdivision?: string | number); start(time?: any): this; stop(time?: any): this; dispose(): void; events: any[]; }
  class Pattern { constructor(callback: (time: any, value: any) => void, values: any[], pattern?: string); start(time?: any): this; stop(time?: any): this; dispose(): void; }
  class Part { constructor(callback: (time: any, value: any) => void, events?: Array<[any, any]>); start(time?: any): this; stop(time?: any): this; dispose(): void; }
  class Loop { constructor(callback: (time: any) => void, interval?: string | number); start(time?: any): this; stop(time?: any): this; dispose(): void; interval: string | number; }
  // Analysis
  class FFT { constructor(size?: number); getValue(): Float32Array; dispose(): void; }
  class Meter { constructor(options?: { smoothing?: number }); getValue(): number | Float32Array; dispose(): void; }
  class Analyser { constructor(type?: 'fft' | 'waveform', size?: number); getValue(): Float32Array; dispose(): void; }
  // Playback
  class Player { constructor(url?: string, onload?: () => void); start(time?: any, offset?: any, duration?: any): this; stop(time?: any): this; connect(node: any): this; toDestination(): this; dispose(): void; loaded: boolean; loop: boolean; loopStart: number; loopEnd: number; }
  class UserMedia { constructor(volume?: number); open(deviceId?: string): Promise<void>; close(): void; connect(node: any): this; }
  // Utilities
  class LFO { constructor(options?: { frequency?: number; min?: number; max?: number; type?: string }); start(): this; stop(): this; connect(node: any): this; toDestination(): this; dispose(): void; amplitude: { value: number }; }
  class Noise { constructor(type?: 'white' | 'pink' | 'brown'); start(): this; stop(): this; connect(node: any): this; toDestination(): this; dispose(): void; }
}
`
