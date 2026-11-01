import { expect, test } from 'vitest'
import { lint } from '../ArtlabLinter.ts'

test('skips TypeScript test modules while diagnosing the same source as an entry', () => {
  const source = "import { expect } from 'vitest'; export function update(ctx) { ctx.nonexistent() }"
  expect(lint(source, 'scene.test.ts')).toEqual([])
  expect(lint(source, 'scene.spec.ts')).toEqual([])
  const diagnostics = lint(source, 'scene.ts')
  expect(diagnostics.some(d => d.severity === 'error' && d.message.includes('vitest'))).toBe(true)
  expect(diagnostics.some(d => d.message.includes('ctx.nonexistent'))).toBe(true)
  expect(diagnostics.every(d => d.file === 'scene.ts' && d.line >= 1 && d.col >= 1)).toBe(true)
})
