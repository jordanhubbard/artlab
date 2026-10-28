import * as Three from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js'

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

export type ArtlabContext = import('./SceneContext.js').SceneContext
  & Omit<typeof import('../stdlib/geometry.js')
    & typeof import('../stdlib/lights.js')
    & typeof import('../stdlib/math.js'), keyof import('./SceneContext.js').SceneContext>
export type SketchContext<State> = ArtlabContext & { state: State }
export interface Sketch<State> {
  setup(ctx: SketchContext<State>): void | Promise<void>
  update?(ctx: SketchContext<State>, dt: number): void
  teardown?(ctx: SketchContext<State>): void | Promise<void>
}
