import { describe, it, expect } from 'vitest'
import { rollup } from 'rollup'
import { ModuleCompiler } from '../ModuleCompiler.ts'

const compile = (files, entry = 'main.ts', library) => new ModuleCompiler({
  rollup, library, baseURL: 'https://example.org/artlab/',
}).compile({ manifest: { entry }, artFiles: new Map(Object.entries(files)) })
const execute = code => import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)

describe('editable module graph', () => {
  it('runs transitive imports and re-exports using edits from every file', async () => {
    const files = {
      'main.ts': "export { result } from './nested/scene.ts'",
      'nested/scene.ts': "import { value } from '../value.ts'; export const result = value * 2",
      'value.ts': 'export const value = 3',
    }
    expect((await execute((await compile(files)).code)).result).toBe(6)
    files['value.ts'] = 'export const value = 7'
    expect((await execute((await compile(files)).code)).result).toBe(14)
  })

  it('loads shared library source but gives edited workspace copies priority', async () => {
    const library = {
      has: path => path === 'src/shared.ts',
      read: async () => 'export const value = 5',
    }
    const files = { 'examples/test/main.ts': "export { value } from '../../src/shared.ts'" }
    const result = await compile(files, 'examples/test/main.ts', library)
    expect(result.dependencies.get('src/shared.ts')).toContain('value = 5')
    expect((await execute(result.code)).value).toBe(5)
    files['src/shared.ts'] = 'export const value = 9'
    expect((await execute((await compile(files, 'examples/test/main.ts', library)).code)).value).toBe(9)
  })

  it('supports live bindings across circular imports', async () => {
    const result = await compile({
      'main.ts': "import { read } from './helper.ts'; export let value = 4; export const result = read()",
      'helper.ts': "import { value } from './main.ts'; export function read() { return value + 1 }",
    })
    expect((await execute(result.code)).result).toBe(5)
  })

  it('supports literal dynamic imports', async () => {
    const result = await compile({
      'main.ts': "export async function read() { return (await import('./helper.ts')).value }",
      'helper.ts': 'export const value = 12',
    })
    expect(await (await execute(result.code)).read()).toBe(12)
  })

  it('transpiles TypeScript classes and resolves extensionless imports', async () => {
    const result = await compile({
      'main.ts': "import { Scale } from './Scale'; export const value: number = new Scale(3).double()",
      'Scale.ts': 'export class Scale { constructor(private value: number) {} double(): number { return this.value * 2 } }',
    }, 'main.ts')
    expect((await execute(result.code)).value).toBe(6)
  })

  it('preserves original module URLs for relative assets under a hosting subpath', async () => {
    const result = await compile({ 'examples/demo/main.ts': "export const url = new URL('./assets/test.png', import.meta.url).href" }, 'examples/demo/main.ts')
    expect((await execute(result.code)).url).toBe('https://example.org/artlab/examples/demo/assets/test.png')
  })

  it('reports missing modules and syntax errors without a false success', async () => {
    await expect(compile({ 'main.ts': "import './missing.ts'" })).rejects.toThrow("Cannot resolve './missing.ts' from main.ts")
    await expect(compile({ 'main.ts': 'export const broken = ;' })).rejects.toThrow()
  })
})

it('resolves computed package asset URLs to owned blobs and revokes them on disposal', async () => {
  const compiler = new ModuleCompiler({ rollup, baseURL: 'https://example.org/artlab/' })
  const result = await compiler.compile({
    manifest: { entry: 'nested/main.ts' },
    artFiles: new Map([['nested/main.ts', "const file = 'message.txt'; export const asset = new URL(`./assets/${file}`, import.meta.url).href"]]),
    assetFiles: new Map([['nested/assets/message.txt', new TextEncoder().encode('asset from the package')]]),
  })
  const { asset } = await execute(result.code)
  expect(asset.startsWith('blob:')).toBe(true)
  expect(await (await fetch(asset)).text()).toBe('asset from the package')
  result.dispose()
  await expect(fetch(asset)).rejects.toThrow()
})
