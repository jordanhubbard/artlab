/**
 * Artlab DSL Transpiler
 * Wires together: Lexer → Parser → SemanticAnalyzer → Codegen
 */

import { Lexer }             from './Lexer.js';
import { Parser }            from './Parser.js';
import { SemanticAnalyzer }  from './SemanticAnalyzer.js';
import { Codegen }           from './Codegen.js';

export class Transpiler {
  /**
   * Transpiles Artlab DSL source code to JavaScript.
   *
   * @param {string} src
   * @param {object} [options]
   * @param {boolean} [options.strict] - Default true. If true and there are
   *   semantic errors, sets ok=false and includes them in `errors`.
   *   Pass `strict: false` to emit code even when semantic errors exist.
   * @returns {{ code: string, errors: Array, warnings: Array, ok: boolean }}
   */
  transpile(src, options = {}) {
    const strict = options.strict !== false;

    let tokens, ast, semResult, code;
    const errors   = [];
    const warnings = [];

    // ── 1. Lex ────────────────────────────────────────────────────────────────

    try {
      const lexer = new Lexer(src);
      tokens = lexer.tokenize();
    } catch (err) {
      errors.push({ message: err.message, line: err.line || 0, col: err.col || 0 });
      return { code: '', errors, warnings, ok: false };
    }

    // ── 2. Parse ──────────────────────────────────────────────────────────────

    try {
      const parser = new Parser(tokens);
      ast = parser.parse();
    } catch (err) {
      errors.push({ message: err.message, line: err.line || 0, col: err.col || 0 });
      return { code: '', errors, warnings, ok: false };
    }

    // ── 3. Semantic analysis ──────────────────────────────────────────────────

    try {
      const analyzer = new SemanticAnalyzer();
      semResult = analyzer.analyze(ast);
      errors.push(...semResult.errors);
      warnings.push(...semResult.warnings);
    } catch (err) {
      errors.push({ message: err.message, line: err.line || 0, col: err.col || 0 });
      return { code: '', errors, warnings, ok: false };
    }

    // If strict mode and semantic errors, bail early
    if (strict && errors.length > 0) {
      return { code: '', errors, warnings, ok: false };
    }

    // ── 4. Code generation ────────────────────────────────────────────────────

    try {
      const codegen = new Codegen();
      code = codegen.generate(semResult ? semResult.ast : ast);
    } catch (err) {
      errors.push({ message: err.message, line: err.line || 0, col: err.col || 0 });
      return { code: '', errors, warnings, ok: false };
    }

    return {
      code,
      errors,
      warnings,
      ok: errors.length === 0,
    };
  }
}

/** Convenience singleton */
export const transpiler = new Transpiler();
