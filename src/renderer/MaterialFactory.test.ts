import { expect, test } from 'vitest'
import * as Three from 'three'
import { createMaterial } from './MaterialFactory.ts'

test('creates typed PBR, emissive, and unlit materials with common render settings', () => {
  for (const type of ['pbr', 'emissive', 'unlit'] as const) {
    const material = createMaterial({ type, color: '#ff8800', transparent: true, depthWrite: false })
    expect(material).toBeInstanceOf(type === 'unlit' ? Three.MeshBasicMaterial : Three.MeshStandardMaterial)
    expect(material.transparent).toBe(true)
    expect(material.depthWrite).toBe(false)
    material.dispose()
  }
})

test('custom material preserves shader uniforms and shared settings', () => {
  const uniforms = { phase: { value: 1 } }
  const material = createMaterial({ type: 'custom', vertexShader: 'void main(){}', fragmentShader: 'void main(){}', uniforms, side: Three.DoubleSide })
  expect(material).toBeInstanceOf(Three.ShaderMaterial)
  if (material instanceof Three.ShaderMaterial) expect(material.uniforms).toBe(uniforms)
  expect(material.side).toBe(Three.DoubleSide)
  material.dispose()
})
