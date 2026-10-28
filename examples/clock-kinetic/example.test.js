import { test, expect } from 'vitest'
import * as alias from './clock-kinetic.js'
import * as canonical from '../clock-3d/clock-3d.js'
test('legacy package delegates to the consolidated lesson', () => {
  expect(alias.setup).toBe(canonical.setup)
  expect(alias.update).toBe(canonical.update)
  expect(alias.teardown).toBe(canonical.teardown)
})
