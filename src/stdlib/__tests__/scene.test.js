// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import * as Three from 'three'
import { ResourceScope, Scene, defineScene, ParticleField, InstanceField, Trail, ShaderSurface, GestureButton } from '../scene.js'

function context() {
  const scene = new Three.Scene()
  return {
    scene, elapsed: 0,
    camera: new Three.PerspectiveCamera(),
    renderer: { domElement: document.createElement('canvas') },
    add: object => scene.add(object), remove: object => scene.remove(object),
  }
}

describe('resource ownership', () => {
  it('disposes nested shared geometry, materials, and textures exactly once', async () => {
    const scope = new ResourceScope(), ctx = context()
    const geometry = new Three.BoxGeometry()
    const texture = new Three.Texture()
    const material = new Three.MeshBasicMaterial({ map: texture })
    const spies = [geometry, texture, material].map(resource => vi.spyOn(resource, 'dispose'))
    const group = new Three.Group()
    group.add(new Three.Mesh(geometry, material), new Three.Mesh(geometry, material))
    scope.add(ctx, group)
    scope.own(texture)
    await scope.dispose()
    await scope.dispose()
    expect(ctx.scene.children).toHaveLength(0)
    for (const spy of spies) expect(spy).toHaveBeenCalledTimes(1)
  })

  it('removes listeners/DOM, restores settings, and cleans resources acquired after disposal', async () => {
    const scope = new ResourceScope(), handler = vi.fn()
    const settings = { enabled: true }
    const button = scope.append(document.body, document.createElement('button'))
    scope.listen(button, 'click', handler)
    scope.set(settings, 'enabled', false)
    button.click()
    await scope.dispose()
    button.click()
    const late = { dispose: vi.fn() }
    scope.own(late)
    expect(handler).toHaveBeenCalledTimes(1)
    expect(button.isConnected).toBe(false)
    expect(settings.enabled).toBe(true)
    expect(late.dispose).toHaveBeenCalledTimes(1)
  })

  it('finishes other cleanup even if a disposer throws', async () => {
    const scope = new ResourceScope(), cleanup = vi.fn()
    scope.defer(cleanup)
    scope.defer(() => { throw new Error('failed') })
    await expect(scope.dispose()).rejects.toThrow('Scene cleanup failed')
    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  it('keeps scene instances independent and disposes a failed setup', async () => {
    const instances = []
    class Demo extends Scene {
      setup() { instances.push(this); this.field = this.use(new ParticleField(4)) }
      update(dt) { this.field.positions[0] += dt }
    }
    const demo = defineScene(Demo), a = context(), b = context()
    demo.setup(a); demo.setup(b)
    demo.update(a, 1)
    expect(instances[0].field.positions[0]).toBe(1)
    expect(instances[1].field.positions[0]).toBe(0)
    await demo.teardown(a)
    expect(a.scene.children).toHaveLength(0)
    expect(b.scene.children).toHaveLength(1)
    await demo.teardown(b)
    class Broken extends Demo { setup() { super.setup(); throw new Error('broken') } }
    expect(() => defineScene(Broken).setup(a)).toThrow('broken')
    expect(a.scene.children).toHaveLength(0)
  })
})

describe('rendering components', () => {
  it('keeps trails chronological after repeated wraparound with fixed storage', () => {
    const trail = new Trail(3)
    const buffer = trail.positions
    for (let x = 0; x < 11; x++) trail.push({ x, y: x * 2, z: 0 })
    const { start, count } = trail.object.geometry.drawRange
    expect(count).toBe(3)
    expect(Array.from(buffer.slice(start * 3, (start + count) * 3))).toEqual([8, 16, 0, 9, 18, 0, 10, 20, 0])
    expect(trail.positions).toBe(buffer)
    trail.clear()
    expect(trail.object.geometry.drawRange.count).toBe(0)
    trail.dispose()
  })

  it('updates instance transforms and colors without making separate meshes', () => {
    const field = new InstanceField(500, new Three.SphereGeometry(), new Three.MeshBasicMaterial())
    field.set(499, new Three.Vector3(2, 3, 4), 0.5, 0xff3300)
    field.commit()
    const matrix = new Three.Matrix4()
    field.object.getMatrixAt(499, matrix)
    expect(new Three.Vector3().setFromMatrixPosition(matrix).toArray()).toEqual([2, 3, 4])
    expect(matrix.elements[0]).toBe(0.5)
    expect(field.object.count).toBe(500)
    field.dispose()
  })

  it('tracks canvas size changes without window resize events', () => {
    const ctx = context()
    const surface = new ShaderSurface(ctx.renderer, 'void main() { gl_FragColor = vec4(1.); }')
    ctx.renderer.domElement.width = 777
    ctx.renderer.domElement.height = 333
    surface.update(0.1, 4)
    expect(surface.uniforms.uResolution.value.toArray()).toEqual([777, 333])
    expect(surface.uniforms.uTime.value).toBe(4)
    surface.dispose()
  })

  it('allows gesture retry and never resurrects a disposed button after rejection', async () => {
    const start = vi.fn().mockRejectedValueOnce(new Error('denied')).mockResolvedValueOnce()
    const gesture = new GestureButton(document.body, { label: 'Start', start, onError: vi.fn() })
    gesture.button.click()
    await vi.waitFor(() => expect(gesture.button.disabled).toBe(false))
    expect(gesture.button.textContent).toContain('retry')
    gesture.button.click()
    await vi.waitFor(() => expect(gesture.button.isConnected).toBe(false))
    gesture.dispose()
    expect(start).toHaveBeenCalledTimes(2)
  })
})
