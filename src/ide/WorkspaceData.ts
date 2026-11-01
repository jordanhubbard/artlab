export interface PackageManifest {
  name: string
  entry: string
  version?: string
  [key: string]: unknown
}

export interface TutorialPage {
  id: string
  title: string
  body?: string
  parent?: string
  file?: string
  lines?: [number, number]
}
export interface Tutorial { title: string; pages: TutorialPage[] }

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function readManifest(value: unknown): PackageManifest {
  if (!record(value)) throw new TypeError('Manifest must be a JSON object')
  if (typeof value.entry !== 'string' || !value.entry.trim()) throw new TypeError('Manifest requires a non-empty string entry')
  if (typeof value.name !== 'string' || !value.name.trim()) throw new TypeError('"name" must be a non-empty string')
  if (value.version !== undefined && typeof value.version !== 'string') throw new TypeError('"version" must be a string')
  return { ...value, name: value.name, entry: value.entry, version: value.version }
}

export function parseManifest(source: string): PackageManifest {
  let value: unknown
  try { value = JSON.parse(source) }
  catch (error) { throw new TypeError(`JSON parse error: ${errorMessage(error)}`) }
  return readManifest(value)
}

export function readSavedProject(value: unknown) {
  if (!record(value) || !record(value.artFiles)) throw new TypeError('Invalid saved project')
  const manifest = readManifest(value.manifest)
  const artFiles = new Map<string, string>()
  for (const [path, source] of Object.entries(value.artFiles)) {
    if (typeof source !== 'string') throw new TypeError(`Saved source must be text: ${path}`)
    artFiles.set(path, source)
  }
  if (value.activeFile !== null && value.activeFile !== undefined && typeof value.activeFile !== 'string') {
    throw new TypeError('Saved active file must be a string')
  }
  return { manifest, artFiles, activeFile: value.activeFile ?? null }
}

export function parseTutorial(source: string): Tutorial {
  const value: unknown = JSON.parse(source)
  if (!record(value) || typeof value.title !== 'string' || !Array.isArray(value.pages)) {
    throw new TypeError('Tutorial requires a title and pages')
  }
  const pages = value.pages.map((page: unknown): TutorialPage => {
    if (!record(page) || typeof page.id !== 'string' || typeof page.title !== 'string') {
      throw new TypeError('Tutorial pages require an id and title')
    }
    const result: TutorialPage = { id: page.id, title: page.title }
    for (const key of ['body', 'parent', 'file'] as const) {
      if (page[key] === undefined || page[key] === null) continue
      if (typeof page[key] !== 'string') throw new TypeError(`Tutorial ${key} must be text`)
      result[key] = page[key]
    }
    if (page.lines !== undefined) {
      const lines: unknown = page.lines
      if (!Array.isArray(lines) || lines.length !== 2
        || !lines.every((line): line is number => typeof line === 'number' && Number.isInteger(line) && line > 0)
        || lines[1] < lines[0]) throw new TypeError('Tutorial lines require an ordered positive range')
      result.lines = [lines[0], lines[1]]
    }
    return result
  })
  const byId = new Map(pages.map(page => [page.id, page]))
  if (byId.size !== pages.length) throw new TypeError('Tutorial page ids must be unique')
  for (const page of pages) {
    const seen = new Set([page.id])
    let parent = page.parent
    while (parent) {
      if (seen.has(parent) || !byId.has(parent)) throw new TypeError('Invalid tutorial ancestry')
      seen.add(parent)
      parent = byId.get(parent)?.parent
    }
  }
  return { title: value.title, pages }
}
