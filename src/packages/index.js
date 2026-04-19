/**
 * src/packages — Artlab package system
 *
 * Re-exports all public classes and utilities for the package format,
 * reading, writing, dev-mode resolution, static linking, and runtime loading.
 */

export { MANIFEST_FILENAME, parseManifest, validateManifest } from './Manifest.js'
export { PackageReader, MockPackageReader }                    from './PackageReader.js'
export { PackageWriter }                                       from './PackageWriter.js'
export { DevResolver }                                         from './DevResolver.js'
export { StaticLinker }                                        from './StaticLinker.js'
export { PackageLoader }                                       from './PackageLoader.js'
