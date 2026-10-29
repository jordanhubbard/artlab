import { test, expect } from 'vitest'
import * as alias from './particle-storm.ts'
import * as canonical from '../physics-particles/physics-particles.ts'
test('legacy package delegates to the consolidated lesson', () => {
  expect(alias.setup).toBe(canonical.setup)
  expect(alias.update).toBe(canonical.update)
  expect(alias.teardown).toBe(canonical.teardown)
})
