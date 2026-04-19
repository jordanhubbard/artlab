/**
 * Artlab DSL — public API barrel export
 *
 * Primary usage:
 *   import { transpiler } from './dsl/index.js'
 *   const { code, errors, warnings, ok } = transpiler.transpile(src)
 *
 * Lower-level pipeline components are also exported for tooling use.
 */

export { Transpiler, transpiler } from './Transpiler.js';
export { Lexer, Token, TokenType } from './Lexer.js';
export { Parser }                  from './Parser.js';
export { SemanticAnalyzer }        from './SemanticAnalyzer.js';
export { Codegen }                 from './Codegen.js';
export { ArtlabError, ErrorReporter } from './ErrorReporter.js';
