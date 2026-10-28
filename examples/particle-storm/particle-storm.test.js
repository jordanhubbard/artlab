import { test, expect } from 'vitest'
import * as alias from './particle-storm.js'
import * as canonical from '../physics-particles/physics-particles.js'
test('legacy package delegates to the consolidated lesson', () => {
  expect(alias.setup).toBe(canonical.setup)
  expect(alias.update).toBe(canonical.update)
  expect(alias.teardown).toBe(canonical.teardown)
})
