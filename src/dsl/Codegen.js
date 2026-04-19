/**
 * Artlab DSL Code Generator
 * Generates JavaScript from an Artlab DSL AST.
 *
 * Mapping summary:
 *   use "artlab/geometry"        → import * as _geo from '/artlab/stdlib/geometry.js'
 *   use url:"https://..."        → import * as _ext0 from "https://..."
 *   use embedded:"libs/..."      → import * as _emb0 from new URL("libs/...", import.meta.url)
 *   fn setup() { ... }           → export function setup() { ... }
 *   let x = 3                    → let x = 3
 *   loop i from 0 to 10 { ... }  → for (let i = 0; i < 10; i++) { ... }
 *   every 1.0 { ... }            → setInterval(() => { ... }, 1000)
 *   vec3(1,2,3)                  → new THREE.Vector3(1,2,3)
 *   color(1,0,0)                 → new THREE.Color(1,0,0)
 *   vec2(x,y)                    → new THREE.Vector2(x,y)
 */

export class Codegen {
  constructor() {
    this._lines  = [];
    this._indent = 0;
    // Counters for generating unique import aliases
    this._extCount = 0;
    this._embCount = 0;
    this._stdCount = 0;
  }

  // ── Public API ────────────────────────────────────────────────────────────────

  /**
   * Generates JavaScript source from an AST.
   * @param {object} ast - Program node
   * @returns {string}
   */
  generate(ast) {
    this._lines    = [];
    this._indent   = 0;
    this._extCount = 0;
    this._embCount = 0;
    this._stdCount = 0;

    this._genProgram(ast);
    return this._lines.join('\n');
  }

  // ── Emit helpers ──────────────────────────────────────────────────────────────

  _pad() {
    return '  '.repeat(this._indent);
  }

  _emit(line) {
    this._lines.push(this._pad() + line);
  }

  _emitBlank() {
    this._lines.push('');
  }

  _indented(fn) {
    this._indent++;
    fn();
    this._indent--;
  }

  // ── Program ───────────────────────────────────────────────────────────────────

  _genProgram(node) {
    // 1. Emit use/import statements first
    for (const stmt of node.body) {
      if (stmt.type === 'UseStmt') this._genUseStmt(stmt);
    }

    // Blank line after imports if any
    const hasImports = node.body.some(s => s.type === 'UseStmt');
    if (hasImports) this._emitBlank();

    // 2. Emit everything else
    for (const stmt of node.body) {
      if (stmt.type !== 'UseStmt') {
        this._genStmt(stmt);
      }
    }
  }

  // ── Statements ────────────────────────────────────────────────────────────────

  _genStmt(node) {
    switch (node.type) {
      case 'UseStmt':    return this._genUseStmt(node);
      case 'FnDef':      return this._genFnDef(node);
      case 'VarDecl':    return this._genVarDecl(node);
      case 'Assign':     return this._genAssign(node);
      case 'IfStmt':     return this._genIfStmt(node);
      case 'LoopStmt':   return this._genLoopStmt(node);
      case 'EveryStmt':  return this._genEveryStmt(node);
      case 'ReturnStmt': return this._genReturnStmt(node);
      case 'ExprStmt':   return this._genExprStmt(node);
      default:
        this._emit(`/* unhandled stmt: ${node.type} */`);
    }
  }

  // ── use statement → import ────────────────────────────────────────────────────

  _genUseStmt(node) {
    switch (node.kind) {
      case 'stdlib': {
        // use "artlab/geometry" → import * as _geo0 from '/artlab/stdlib/geometry.js'
        // Use the last path segment as part of the alias
        const segments  = node.path.split('/');
        const lastSeg   = segments[segments.length - 1].replace(/[^a-zA-Z0-9_]/g, '_');
        const alias     = `_${lastSeg}${this._stdCount++}`;
        // Map artlab/... → /artlab/stdlib/...
        const jsPath    = node.path.startsWith('artlab/')
          ? `/artlab/stdlib/${segments.slice(1).join('/')}.js`
          : `/${node.path}.js`;
        this._emit(`import * as ${alias} from '${jsPath}';`);
        break;
      }

      case 'url': {
        // use url:"https://..." → import * as _ext0 from "https://..."
        const alias = `_ext${this._extCount++}`;
        this._emit(`import * as ${alias} from "${node.path}";`);
        break;
      }

      case 'embedded': {
        // use embedded:"libs/..." → import * as _emb0 from new URL("libs/...", import.meta.url)
        const alias = `_emb${this._embCount++}`;
        this._emit(`import * as ${alias} from new URL(${JSON.stringify(node.path)}, import.meta.url);`);
        break;
      }

      default:
        this._emit(`/* unknown use kind: ${node.kind} */`);
    }
  }

  // ── fn definition → export function ─────────────────────────────────────────

  _genFnDef(node) {
    const params = node.params.map(p => p.name).join(', ');
    this._emit(`export function ${node.name}(${params}) {`);
    this._indented(() => {
      for (const stmt of node.body) this._genStmt(stmt);
    });
    this._emit('}');
    this._emitBlank();
  }

  // ── let declaration ───────────────────────────────────────────────────────────

  _genVarDecl(node) {
    this._emit(`let ${node.name} = ${this._genExpr(node.init)};`);
  }

  // ── assignment ────────────────────────────────────────────────────────────────

  _genAssign(node) {
    const lhs = node.target.join('.');
    this._emit(`${lhs} = ${this._genExpr(node.value)};`);
  }

  // ── if statement ──────────────────────────────────────────────────────────────

  _genIfStmt(node) {
    this._emit(`if (${this._genExpr(node.test)}) {`);
    this._indented(() => {
      for (const s of node.consequent) this._genStmt(s);
    });
    if (node.alternate && node.alternate.length > 0) {
      // Check if it's an else-if
      if (node.alternate.length === 1 && node.alternate[0].type === 'IfStmt') {
        this._emit('} else ');
        // Inline the nested if (don't add extra blank line)
        const saved = this._lines;
        this._lines = [];
        this._genIfStmt(node.alternate[0]);
        const nested = this._lines;
        this._lines = saved;
        // Merge: replace last line (the '} else ') with combined
        const last = this._lines.pop();
        this._lines.push(last + nested[0].trimStart());
        for (let i = 1; i < nested.length; i++) this._lines.push(nested[i]);
      } else {
        this._emit('} else {');
        this._indented(() => {
          for (const s of node.alternate) this._genStmt(s);
        });
        this._emit('}');
      }
    } else {
      this._emit('}');
    }
  }

  // ── loop statement → for loop ─────────────────────────────────────────────────

  _genLoopStmt(node) {
    const from = this._genExpr(node.from);
    const to   = this._genExpr(node.to);
    this._emit(`for (let ${node.varName} = ${from}; ${node.varName} < ${to}; ${node.varName}++) {`);
    this._indented(() => {
      for (const s of node.body) this._genStmt(s);
    });
    this._emit('}');
  }

  // ── every statement → setInterval ────────────────────────────────────────────

  _genEveryStmt(node) {
    // Interval in seconds → convert to ms
    const intervalMs = this._genIntervalMs(node.interval);
    this._emit(`setInterval(() => {`);
    this._indented(() => {
      for (const s of node.body) this._genStmt(s);
    });
    this._emit(`}, ${intervalMs});`);
  }

  /** Converts an interval expression to milliseconds. */
  _genIntervalMs(node) {
    if (node.type === 'NumberLiteral') {
      // Treat bare number as seconds
      return String(node.value * 1000);
    }
    // For a general expression, multiply by 1000
    return `(${this._genExpr(node)}) * 1000`;
  }

  // ── return statement ──────────────────────────────────────────────────────────

  _genReturnStmt(node) {
    if (node.value) {
      this._emit(`return ${this._genExpr(node.value)};`);
    } else {
      this._emit('return;');
    }
  }

  // ── expression statement ──────────────────────────────────────────────────────

  _genExprStmt(node) {
    this._emit(`${this._genExpr(node.expr)};`);
  }

  // ── Expressions ───────────────────────────────────────────────────────────────

  _genExpr(node) {
    if (!node) return 'undefined';
    switch (node.type) {
      case 'NumberLiteral':  return String(node.value);
      case 'StringLiteral':  return JSON.stringify(node.value);
      case 'BoolLiteral':    return String(node.value);
      case 'NullLiteral':    return 'null';
      case 'Identifier':     return this._genIdentifier(node);
      case 'BinaryExpr':     return `(${this._genExpr(node.left)} ${node.op} ${this._genExpr(node.right)})`;
      case 'UnaryExpr':      return `${node.op}${this._genExpr(node.operand)}`;
      case 'CallExpr':       return this._genCallExpr(node);
      case 'MemberExpr':     return `${this._genExpr(node.object)}.${node.property}`;
      case 'IndexExpr':      return `${this._genExpr(node.object)}[${this._genExpr(node.index)}]`;
      case 'ArrayLiteral':   return `[${node.elements.map(e => this._genExpr(e)).join(', ')}]`;
      case 'ObjectLiteral':  return this._genObjectLiteral(node);
      default:
        return `/* unknown expr: ${node.type} */`;
    }
  }

  _genIdentifier(node) {
    return node.name;
  }

  _genCallExpr(node) {
    const callee = node.callee;
    const args   = node.args.map(a => this._genExpr(a)).join(', ');

    // Intercept DSL type constructors
    if (callee.type === 'Identifier') {
      switch (callee.name) {
        case 'vec3':  return `new THREE.Vector3(${args})`;
        case 'vec2':  return `new THREE.Vector2(${args})`;
        case 'color': return `new THREE.Color(${args})`;
      }
    }

    return `${this._genExpr(callee)}(${args})`;
  }

  _genObjectLiteral(node) {
    if (node.properties.length === 0) return '{}';
    const pairs = node.properties.map(p => {
      const key = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(p.key) ? p.key : JSON.stringify(p.key);
      return `${key}: ${this._genExpr(p.value)}`;
    });
    return `{ ${pairs.join(', ')} }`;
  }
}
