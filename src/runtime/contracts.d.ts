import type * as Three from 'three'
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js'

export interface RuntimeBindings {
  scene: Three.Scene
  camera: Three.PerspectiveCamera
  renderer: Three.WebGLRenderer
  controls: OrbitControls
  labelRenderer: CSS2DRenderer
  setBloom(strength?: number): void
  setHelp(text?: string | null): void
  loadTexture?(path: string): Three.Texture
}

export interface ResourceScope {
  own<T extends Three.Object3D | { dispose(): unknown }>(resource: T): T
  defer(cleanup: () => unknown): () => unknown
  listen(target: EventTarget, type: string, handler: EventListenerOrEventListenerObject, options?: AddEventListenerOptions | boolean): EventListenerOrEventListenerObject
  dispose(): Promise<void>
}

export interface MeshOptions extends Three.MeshStandardMaterialParameters {
  side?: 'front' | 'back' | 'double' | Three.Side
}

export interface ArtlabContext extends RuntimeBindings {
  Three: typeof Three
  elapsed: number
  scope: ResourceScope
  add<T extends Three.Object3D>(object: T): T
  remove<T extends Three.Object3D>(object: T): T
  box(width?: number, height?: number, depth?: number): Three.BoxGeometry
  sphere(radius?: number, widthSegments?: number, heightSegments?: number): Three.SphereGeometry
  torus(radius?: number, tube?: number, radialSegments?: number, tubularSegments?: number): Three.TorusGeometry
  mesh<G extends Three.BufferGeometry>(geometry: G, options?: MeshOptions): Three.Mesh<G, Three.MeshStandardMaterial>
  ambient(color?: Three.ColorRepresentation, intensity?: number): Three.AmbientLight
  point(color?: Three.ColorRepresentation, intensity?: number, distance?: number, decay?: number): Three.PointLight
  lerp(a: number, b: number, t: number): number
  clamp(value: number, min: number, max: number): number
}

export type SketchContext<State> = ArtlabContext & { state: State }
export interface Sketch<State> {
  setup(ctx: SketchContext<State>): void | Promise<void>
  update?(ctx: SketchContext<State>, dt: number): void
  teardown?(ctx: SketchContext<State>): void | Promise<void>
}
