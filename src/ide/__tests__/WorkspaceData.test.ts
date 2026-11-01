import { expect, test } from 'vitest'
import { parseManifest, parseTutorial, readSavedProject } from '../WorkspaceData.ts'

test('validates package fields while retaining extra export metadata', () => {
  expect(parseManifest('{"name":"study","entry":"main.ts","license":"MIT"}')).toMatchObject({
    name: 'study', entry: 'main.ts', license: 'MIT',
  })
  for (const value of [null, [], { name: 'study', entry: 42 }, { name: false, entry: 'main.ts' }, { name: 'study', entry: 'main.ts', version: {} }]) {
    expect(() => parseManifest(JSON.stringify(value))).toThrow(TypeError)
  }
})

test('restores source as text and rejects malformed saved workspaces', () => {
  const project = {
    manifest: { name: 'study', entry: 'main.ts' },
    artFiles: { 'main.ts': 'export function setup() {}' }, activeFile: 'main.ts',
  }
  expect(readSavedProject(project).artFiles.get('main.ts')).toContain('setup')
  for (const value of [{ ...project, artFiles: { 'main.ts': 42 } }, { ...project, activeFile: {} }, { manifest: project.manifest }]) {
    expect(() => readSavedProject(value)).toThrow(TypeError)
  }
})

test('rejects tutorial cycles and malformed code ranges before rendering', () => {
  const page = { id: 'intro', title: 'Introduction' }
  for (const pages of [
    [{ ...page, parent: 'intro' }],
    [{ ...page, parent: 'missing' }],
    [page, page],
    [{ ...page, lines: [4, 2] }],
    [{ ...page, body: {} }],
  ]) expect(() => parseTutorial(JSON.stringify({ title: 'Study', pages }))).toThrow(TypeError)
})

test('every bundled tutorial still satisfies the rendering contract', () => {
  const tutorials = import.meta.glob<string>('../../../examples/*/tutorial.json', { eager: true, query: '?raw', import: 'default' })
  expect(Object.keys(tutorials).length).toBeGreaterThan(10)
  for (const [path, source] of Object.entries(tutorials)) {
    expect(() => parseTutorial(source), path).not.toThrow()
  }
})
