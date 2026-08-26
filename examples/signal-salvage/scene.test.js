import { describe, expect, it, vi } from 'vitest'
import * as Three from 'three'
import { MAX_FRAGMENTS, MAX_HAZARDS, createGame, startGame } from './game.js'
import { createSignalScene } from './scene.js'

function makeCtx() {
  const scene = new Three.Scene()
  return {
    scene,
    camera: new Three.PerspectiveCamera(),
    controls: { enabled: true, target: new Three.Vector3() },
    add: vi.fn(object => {
      scene.add(object)
      return object
    }),
    remove: vi.fn(object => scene.remove(object)),
  }
}

describe('Signal Salvage 3D scene', () => {
  it('builds fixed-size fragment and hazard pools', () => {
    const ctx = makeCtx()
    const view = createSignalScene(ctx, new Three.Texture())

    expect(view.fragmentPool).toHaveLength(MAX_FRAGMENTS)
    expect(view.hazardPool).toHaveLength(MAX_HAZARDS)
    expect(ctx.add).toHaveBeenCalledTimes(1)
  })

  it('mirrors game entities and player position without growing pools', () => {
    const ctx = makeCtx()
    const view = createSignalScene(ctx, new Three.Texture())
    const state = createGame()
    startGame(state)
    state.player.x = 2
    state.player.y = -1
    state.fragments.push({ id: 1, x: 1, y: 2, z: -8, active: true })
    state.hazards.push({ id: 2, x: -2, y: 1, z: -10, active: true })

    view.sync(state, [{ type: 'pulse', strength: 0.8 }], 0.016)

    expect(view.craft.position.x).toBe(2)
    expect(view.craft.position.y).toBe(-1)
    expect(view.fragmentPool[0].visible).toBe(true)
    expect(view.fragmentPool[0].position.z).toBe(-8)
    expect(view.hazardPool[0].visible).toBe(true)
    expect(view.fragmentPool).toHaveLength(MAX_FRAGMENTS)
    expect(view.hazardPool).toHaveLength(MAX_HAZARDS)
  })

  it('replaces the fragment texture and disposes all scene resources', () => {
    const ctx = makeCtx()
    const initial = new Three.Texture()
    const replacement = new Three.Texture()
    const view = createSignalScene(ctx, initial)
    const material = view.fragmentPool[0].material
    const dispose = vi.spyOn(material, 'dispose')

    view.setTexture(replacement)
    view.dispose()
    view.dispose()

    expect(material.map).toBe(replacement)
    expect(dispose).toHaveBeenCalledTimes(1)
    expect(ctx.remove).toHaveBeenCalledTimes(1)
  })
})
