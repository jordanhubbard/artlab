/**
 * Artlab DSL Transpiler Test Suite
 *
 * Covers: Lexer, Parser, SemanticAnalyzer, Codegen, Transpiler (integration)
 */

import { describe, it, expect } from 'vitest';

import { Lexer, TokenType } from '../Lexer.js';
import { Parser }           from '../Parser.js';
import { SemanticAnalyzer } from '../SemanticAnalyzer.js';
import { Codegen }          from '../Codegen.js';
import { Transpiler }       from '../Transpiler.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function tokenize(src) {
  return new Lexer(src).tokenize();
}

/** Returns all non-EOF tokens. */
function tokens(src) {
  return tokenize(src).filter(t => t.type !== TokenType.EOF);
}

function parse(src) {
  return new Parser(tokenize(src)).parse();
}

function analyze(src) {
  const ast = parse(src);
  return new SemanticAnalyzer().analyze(ast);
}

function codegen(src) {
  const ast = parse(src);
  return new Codegen().generate(ast);
}

function transpile(src, opts) {
  return new Transpiler().transpile(src, opts);
}

// ─── Lexer Tests ─────────────────────────────────────────────────────────────

describe('Lexer', () => {

  describe('keywords', () => {
    it('tokenizes all statement keywords', () => {
      const src = 'fn let use if else loop from to every return';
      const toks = tokens(src);
      const types = toks.map(t => t.type);
      expect(types).toEqual([
        TokenType.FN,
        TokenType.LET,
        TokenType.USE,
        TokenType.IF,
        TokenType.ELSE,
        TokenType.LOOP,
        TokenType.FROM,
        TokenType.TO,
        TokenType.EVERY,
        TokenType.RETURN,
      ]);
    });

    it('tokenizes true, false, null literals', () => {
      const toks = tokens('true false null');
      expect(toks[0].type).toBe(TokenType.TRUE);
      expect(toks[0].value).toBe(true);
      expect(toks[1].type).toBe(TokenType.FALSE);
      expect(toks[1].value).toBe(false);
      expect(toks[2].type).toBe(TokenType.NULL);
      expect(toks[2].value).toBe(null);
    });
  });

  describe('type keywords', () => {
    const typeKws = ['num', 'vec2', 'vec3', 'color', 'bool', 'str', 'mesh', 'scene'];
    for (const kw of typeKws) {
      it(`tokenizes '${kw}' as TYPE`, () => {
        const toks = tokens(kw);
        expect(toks).toHaveLength(1);
        expect(toks[0].type).toBe(TokenType.TYPE);
        expect(toks[0].value).toBe(kw);
      });
    }
  });

  describe('numbers', () => {
    it('tokenizes an integer', () => {
      const toks = tokens('42');
      expect(toks[0].type).toBe(TokenType.NUMBER);
      expect(toks[0].value).toBe(42);
    });

    it('tokenizes a float', () => {
      const toks = tokens('3.14');
      expect(toks[0].type).toBe(TokenType.NUMBER);
      expect(toks[0].value).toBeCloseTo(3.14);
    });

    it('tokenizes scientific notation', () => {
      const toks = tokens('1.0e3');
      expect(toks[0].type).toBe(TokenType.NUMBER);
      expect(toks[0].value).toBe(1000);
    });

    it('tokenizes negative via MINUS + NUMBER', () => {
      const toks = tokens('-5');
      expect(toks[0].type).toBe(TokenType.MINUS);
      expect(toks[1].type).toBe(TokenType.NUMBER);
      expect(toks[1].value).toBe(5);
    });
  });

  describe('strings', () => {
    it('tokenizes a simple double-quoted string', () => {
      const toks = tokens('"hello"');
      expect(toks[0].type).toBe(TokenType.STRING);
      expect(toks[0].value).toBe('hello');
    });

    it('handles \\n escape', () => {
      const toks = tokens('"line1\\nline2"');
      expect(toks[0].value).toBe('line1\nline2');
    });

    it('handles \\\\ and \\" escapes', () => {
      const toks = tokens('"back\\\\slash and \\"quote\\""');
      expect(toks[0].value).toBe('back\\slash and "quote"');
    });

    it('throws on unterminated string (EOF)', () => {
      expect(() => tokenize('"unclosed')).toThrow(/unterminated string/i);
    });

    it('throws on unterminated string (newline)', () => {
      expect(() => tokenize('"oops\n"')).toThrow(/unterminated string/i);
    });
  });

  describe('operators', () => {
    it('tokenizes arithmetic operators', () => {
      const toks = tokens('+ - * /');
      expect(toks.map(t => t.type)).toEqual([
        TokenType.PLUS, TokenType.MINUS, TokenType.STAR, TokenType.SLASH,
      ]);
    });

    it('tokenizes == and !=', () => {
      const toks = tokens('== !=');
      expect(toks[0].type).toBe(TokenType.EQEQ);
      expect(toks[1].type).toBe(TokenType.NEQ);
    });

    it('tokenizes < and >', () => {
      const toks = tokens('< >');
      expect(toks[0].type).toBe(TokenType.LT);
      expect(toks[1].type).toBe(TokenType.GT);
    });

    it('tokenizes <= and >=', () => {
      const toks = tokens('<= >=');
      expect(toks[0].type).toBe(TokenType.LTE);
      expect(toks[1].type).toBe(TokenType.GTE);
    });

    it('tokenizes && and ||', () => {
      const toks = tokens('&& ||');
      expect(toks[0].type).toBe(TokenType.AND);
      expect(toks[1].type).toBe(TokenType.OR);
    });

    it('tokenizes !', () => {
      const toks = tokens('!');
      expect(toks[0].type).toBe(TokenType.BANG);
    });

    it('tokenizes single = (assignment)', () => {
      const toks = tokens('=');
      expect(toks[0].type).toBe(TokenType.EQ);
    });
  });

  describe('line and column tracking', () => {
    it('reports line 1, col 1 for the first token', () => {
      const toks = tokens('fn');
      expect(toks[0].line).toBe(1);
      expect(toks[0].col).toBe(1);
    });

    it('increments line number after a newline', () => {
      const toks = tokens('fn\nlet');
      // 'fn' on line 1, 'let' on line 2
      expect(toks[0].line).toBe(1);
      expect(toks[1].line).toBe(2);
      expect(toks[1].col).toBe(1);
    });

    it('tracks column within a line', () => {
      const toks = tokens('fn setup');
      // 'fn' at col 1, 'setup' at col 4 (after "fn ")
      expect(toks[0].col).toBe(1);
      expect(toks[1].col).toBe(4);
    });
  });

  describe('comments', () => {
    it('skips line comments', () => {
      const toks = tokens('// this is a comment\nfn');
      expect(toks).toHaveLength(1);
      expect(toks[0].type).toBe(TokenType.FN);
    });

    it('skips block comments', () => {
      const toks = tokens('/* block */ fn');
      expect(toks).toHaveLength(1);
      expect(toks[0].type).toBe(TokenType.FN);
    });
  });
});

// ─── Parser Tests ─────────────────────────────────────────────────────────────

describe('Parser', () => {

  describe('fn definition', () => {
    it('parses fn setup() { } into a FnDef node', () => {
      const ast = parse('fn setup() { }');
      expect(ast.type).toBe('Program');
      expect(ast.body).toHaveLength(1);
      const fn = ast.body[0];
      expect(fn.type).toBe('FnDef');
      expect(fn.name).toBe('setup');
      expect(fn.params).toEqual([]);
      expect(fn.body).toEqual([]);
    });

    it('parses fn with typed parameters', () => {
      const fn = parse('fn move(x:num, y:num) { }').body[0];
      expect(fn.params).toHaveLength(2);
      expect(fn.params[0]).toEqual({ name: 'x', typeName: 'num' });
      expect(fn.params[1]).toEqual({ name: 'y', typeName: 'num' });
    });
  });

  describe('var declaration', () => {
    it('parses let x = 3 into a VarDecl node', () => {
      const decl = parse('let x = 3').body[0];
      expect(decl.type).toBe('VarDecl');
      expect(decl.name).toBe('x');
      expect(decl.typeName).toBeNull();
      expect(decl.init.type).toBe('NumberLiteral');
      expect(decl.init.value).toBe(3);
    });

    it('parses let x:num = 3.5 with type annotation', () => {
      const decl = parse('let x:num = 3.5').body[0];
      expect(decl.typeName).toBe('num');
    });
  });

  describe('use statement', () => {
    it('parses use "artlab/math" → UseStmt with kind stdlib', () => {
      const stmt = parse('use "artlab/math"').body[0];
      expect(stmt.type).toBe('UseStmt');
      expect(stmt.kind).toBe('stdlib');
      expect(stmt.path).toBe('artlab/math');
    });

    it('parses use url:"https://ex.com/a.js" → UseStmt with kind url', () => {
      const stmt = parse('use url:"https://ex.com/a.js"').body[0];
      expect(stmt.type).toBe('UseStmt');
      expect(stmt.kind).toBe('url');
      expect(stmt.path).toBe('https://ex.com/a.js');
    });

    it('parses use embedded:"libs/foo.js" → UseStmt with kind embedded', () => {
      const stmt = parse('use embedded:"libs/foo.js"').body[0];
      expect(stmt.type).toBe('UseStmt');
      expect(stmt.kind).toBe('embedded');
    });
  });

  describe('loop statement', () => {
    it('parses loop i from 0 to 10 { } into a LoopStmt', () => {
      const stmt = parse('loop i from 0 to 10 { }').body[0];
      expect(stmt.type).toBe('LoopStmt');
      expect(stmt.varName).toBe('i');
      expect(stmt.from.type).toBe('NumberLiteral');
      expect(stmt.from.value).toBe(0);
      expect(stmt.to.type).toBe('NumberLiteral');
      expect(stmt.to.value).toBe(10);
      expect(stmt.body).toEqual([]);
    });
  });

  describe('every statement', () => {
    it('parses every 1.0 { } into an EveryStmt', () => {
      const stmt = parse('every 1.0 { }').body[0];
      expect(stmt.type).toBe('EveryStmt');
      expect(stmt.interval.type).toBe('NumberLiteral');
      expect(stmt.interval.value).toBe(1.0);
      expect(stmt.body).toEqual([]);
    });
  });

  describe('if statement', () => {
    it('parses if x > 0 { } else { } into an IfStmt', () => {
      const stmt = parse('if x > 0 { } else { }').body[0];
      expect(stmt.type).toBe('IfStmt');
      expect(stmt.test.type).toBe('BinaryExpr');
      expect(stmt.test.op).toBe('>');
      expect(stmt.consequent).toEqual([]);
      expect(stmt.alternate).toEqual([]);
    });

    it('parses if without else (alternate is null)', () => {
      const stmt = parse('if x > 0 { }').body[0];
      expect(stmt.alternate).toBeNull();
    });
  });

  describe('nested fn calls', () => {
    it('parses foo(bar(1, 2), 3) correctly', () => {
      const stmt = parse('foo(bar(1, 2), 3)').body[0];
      const call = stmt.expr;
      expect(call.type).toBe('CallExpr');
      expect(call.callee.name).toBe('foo');
      expect(call.args).toHaveLength(2);

      const innerCall = call.args[0];
      expect(innerCall.type).toBe('CallExpr');
      expect(innerCall.callee.name).toBe('bar');
      expect(innerCall.args[0].value).toBe(1);
      expect(innerCall.args[1].value).toBe(2);

      expect(call.args[1].value).toBe(3);
    });
  });

  describe('member access', () => {
    it('parses obj.position.x into nested MemberExpr nodes', () => {
      const stmt = parse('obj.position.x').body[0];
      const outer = stmt.expr;
      expect(outer.type).toBe('MemberExpr');
      expect(outer.property).toBe('x');

      const inner = outer.object;
      expect(inner.type).toBe('MemberExpr');
      expect(inner.property).toBe('position');
      expect(inner.object.name).toBe('obj');
    });
  });

  describe('error cases', () => {
    it('throws on missing closing brace', () => {
      expect(() => parse('fn foo() {')).toThrow();
    });

    it('throws on missing closing paren in fn params', () => {
      expect(() => parse('fn foo( { }')).toThrow();
    });
  });
});

// ─── Semantic Analyzer Tests ──────────────────────────────────────────────────

describe('SemanticAnalyzer', () => {

  it('reports error for duplicate fn definitions', () => {
    const { errors } = analyze(`
      fn draw() { }
      fn draw() { }
    `);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => /duplicate/i.test(e.message) && /draw/.test(e.message))).toBe(true);
  });

  it('reports error for return used outside a function', () => {
    const { errors } = analyze('return 1');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => /return.*outside/i.test(e.message) || /outside.*function/i.test(e.message))).toBe(true);
  });

  it('reports warning for undefined variable reference', () => {
    const { warnings } = analyze('let x = undeclaredVar');
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.some(w => /undeclaredVar/.test(w.message))).toBe(true);
  });

  it('passes clean (no errors, no warnings) for a valid program', () => {
    const src = `
      fn setup() {
        let x = 10
        let y = 20
        let z = x
      }
    `;
    const { errors, warnings } = analyze(src);
    expect(errors).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });

  it('passes clean for a loop program using the loop variable', () => {
    const src = `
      fn run() {
        loop i from 0 to 5 {
          let v = i
        }
      }
    `;
    const { errors, warnings } = analyze(src);
    expect(errors).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });

  it('allows return inside a function without error', () => {
    const { errors } = analyze('fn foo() { return 42 }');
    expect(errors).toHaveLength(0);
  });
});

// ─── Codegen Tests ────────────────────────────────────────────────────────────

describe('Codegen', () => {

  it('fn setup() { } → export function setup() { }', () => {
    const code = codegen('fn setup() { }');
    expect(code).toContain('export function setup()');
  });

  it('let x = 3 → let x = 3;', () => {
    const code = codegen('let x = 3');
    expect(code).toContain('let x = 3;');
  });

  it('loop i from 0 to 10 { } → for (let i = 0; i < 10; i++) { }', () => {
    const code = codegen('loop i from 0 to 10 { }');
    expect(code).toContain('for (let i = 0; i < 10; i++)');
  });

  it('every 1.0 { } → setInterval(() => { ... }, 1000)', () => {
    const code = codegen('every 1.0 { }');
    expect(code).toContain('setInterval(() => {');
    expect(code).toContain('1000');
  });

  it('vec3(1, 2, 3) → new THREE.Vector3(1, 2, 3)', () => {
    const code = codegen('vec3(1, 2, 3)');
    expect(code).toContain('new THREE.Vector3(1, 2, 3)');
  });

  it('vec2(x, y) → new THREE.Vector2(x, y)', () => {
    const code = codegen('vec2(x, y)');
    expect(code).toContain('new THREE.Vector2(x, y)');
  });

  it('color(1, 0, 0) → new THREE.Color(1, 0, 0)', () => {
    const code = codegen('color(1, 0, 0)');
    expect(code).toContain('new THREE.Color(1, 0, 0)');
  });

  it('use "artlab/math" → import statement for stdlib path', () => {
    const code = codegen('use "artlab/math"');
    expect(code).toMatch(/import \* as _math\d+ from '\/artlab\/stdlib\/math\.js'/);
  });

  it('use url:"https://ex.com/a.js" → import from URL', () => {
    const code = codegen('use url:"https://ex.com/a.js"');
    expect(code).toMatch(/import \* as _ext\d+ from "https:\/\/ex\.com\/a\.js"/);
  });

  it('assignment generates lhs = rhs;', () => {
    const code = codegen('fn f() { let x = 1\nx = 2 }');
    expect(code).toContain('x = 2;');
  });

  it('if statement generates if (...) { }', () => {
    const code = codegen('if x > 0 { }');
    expect(code).toMatch(/if \(.*>\s*0\)/);
  });

  it('return statement generates return expr;', () => {
    const code = codegen('fn f() { return 42 }');
    expect(code).toContain('return 42;');
  });

  it('binary expression is wrapped in parens', () => {
    const code = codegen('let r = 1 + 2');
    expect(code).toContain('(1 + 2)');
  });
});

// ─── Transpiler Integration Tests ────────────────────────────────────────────

describe('Transpiler', () => {

  it('full round-trip: valid DSL → { ok: true, code }', () => {
    const result = transpile('fn setup() { }');
    expect(result.ok).toBe(true);
    expect(typeof result.code).toBe('string');
    expect(result.code).toContain('export function setup()');
    expect(result.errors).toHaveLength(0);
  });

  it('semantic error → { ok: false, errors: [...] }', () => {
    const result = transpile('return 42'); // return outside function
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('lex error (unterminated string) → { ok: false, errors: [...] }', () => {
    const result = transpile('"unterminated');
    expect(result.ok).toBe(false);
    expect(result.errors[0].message).toMatch(/unterminated string/i);
  });

  it('parse error (missing brace) → { ok: false, errors: [...] }', () => {
    const result = transpile('fn foo() {');
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('duplicate fn → { ok: false, errors with duplicate message }', () => {
    const result = transpile('fn draw() { }\nfn draw() { }');
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => /duplicate/i.test(e.message))).toBe(true);
  });

  it('strict: false allows codegen despite semantic errors', () => {
    const result = transpile('return 42', { strict: false });
    // Should still produce code even though there is a semantic error
    expect(typeof result.code).toBe('string');
    expect(result.code.length).toBeGreaterThan(0);
  });

  it('result includes warnings array', () => {
    const result = transpile('fn f() { let x = undeclaredVar }');
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it('realistic small program compiles without error', () => {
    const src = `
use "artlab/math"

fn setup() {
  let pos = vec3(0, 1, 0)
  let speed = 2.5
}

fn update(dt:num) {
  let t = dt
  if t > 0 {
    let v = vec3(t, 0, 0)
  }
}

fn draw() {
  loop i from 0 to 8 {
    let angle = i
  }
}
    `;
    const result = transpile(src);
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.code).toContain('export function setup()');
    expect(result.code).toContain('export function update(dt)');
    expect(result.code).toContain('export function draw()');
    expect(result.code).toContain('new THREE.Vector3');
    expect(result.code).toContain('for (let i = 0; i < 8; i++)');
    expect(result.code).toMatch(/import \* as _math\d+ from '\/artlab\/stdlib\/math\.js'/);
  });
});
