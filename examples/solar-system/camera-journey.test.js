// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import * as Three from 'three'
import {
  FLYBY_TARGETS,
  setupJourney,
  startJourney,
  updateJourney,
  journeyStatus,
} from './camera-journey.js'

const PLANET_POSITIONS = {
  mercury: [38, 0, 4],
  venus: [70, 0, -18],
  earth: [98, 0, 14],
  mars: [150, 0, -42],
  jupiter: [510, 0, 90],
  saturn: [940, 0, -120],
  uranus: [1900, 0, 320],
  neptune: [3010, 0, -460],
}

function makeCtx() {
  const planets = {}
  for (const [name, pos] of Object.entries(PLANET_POSITIONS)) {
    planets[name] = { position: new Three.Vector3(...pos) }
  }
  return {
    Three,
    _planets: planets,
    camera: {
      position: new Three.Vector3(),
      lookAt: vi.fn(),
    },
    controls: {
      target: new Three.Vector3(),
    },
  }
}

describe('solar-system camera journey', () => {
  it('targets every planet before the Pluto transfer and beyond', () => {
    expect(FLYBY_TARGETS).toEqual([
      'mercury',
      'venus',
      'earth',
      'mars',
      'jupiter',
      'saturn',
      'uranus',
      'neptune',
      'pluto-transfer',
      'beyond',
    ])
  })

  it('moves only the camera and does not mutate live planet positions', () => {
    const ctx = makeCtx()
    const before = Object.fromEntries(
      Object.entries(ctx._planets).map(([name, planet]) => [name, planet.position.clone()])
    )

    setupJourney(ctx)
    startJourney(ctx)
    updateJourney(ctx, 9)

    expect(ctx.camera.position.length()).toBeGreaterThan(0)
    expect(ctx.camera.lookAt).toHaveBeenCalled()
    for (const [name, planet] of Object.entries(ctx._planets)) {
      expect(planet.position.equals(before[name])).toBe(true)
    }
  })

  it('reports increasing spacecraft speed through successive assists', () => {
    const ctx = makeCtx()
    setupJourney(ctx)
    startJourney(ctx)

    updateJourney(ctx, 1)
    const initial = journeyStatus(ctx).speed
    for (let i = 0; i < 8; i++) updateJourney(ctx, 18)
    const later = journeyStatus(ctx).speed

    expect(later).toBeGreaterThan(initial)
  })
})
