/**
 * Artlab DSL Semantic Analyzer
 *
 * Checks performed:
 *   - Undefined variable references (warning)
 *   - Duplicate function names (error)
 *   - Type mismatch on let declaration when type annotation is present (warning)
 *   - return used outside a function (error)
 */

// ─── Scope ────────────────────────────────────────────────────────────────────

class Scope {
  constructor(parent = null, kind = 'block') {
    this.parent = parent;
    this.kind   = kind; // 'global' | 'function' | 'block'
    this.names  = new Map(); // name → { kind, node }
  }

  define(name, kind, node) {
    if (this.names.has(name)) return false;
    this.names.set(name, { kind, node });
    return true;
  }

  lookup(name) {
    if (this.names.has(name)) return this.names.get(name);
    if (this.parent) return this.parent.lookup(name);
    return null;
  }

  findFunction() {
    if (this.kind === 'function') return this;
    return this.parent ? this.parent.findFunction() : null;
  }
}

// ─── SemanticAnalyzer ────────────────────────────────────────────────────────

export class SemanticAnalyzer {
  constructor() {
    this._errors   = [];
    this._warnings = [];
    this._scope    = null;
  }

  /**
   * Analyzes the AST.
   * @param {object} ast - Program node from Parser
   * @returns {{ ast: object, errors: Array, warnings: Array }}
   */
  analyze(ast) {
    this._errors   = [];
    this._warnings = [];
    this._scope    = new Scope(null, 'global');

    // Pre-declare well-known runtime globals to suppress spurious warnings
    const runtimeGlobals = [
      // JS builtins
      'Math', 'console', 'setTimeout', 'setInterval', 'clearInterval',
      'clearTimeout', 'parseInt', 'parseFloat', 'isNaN', 'isFinite',
      'Array', 'Object', 'String', 'Number', 'Boolean', 'JSON',
      'Promise', 'Error',
      // THREE.js
      'THREE',
      // Artlab runtime
      'runtime', 'scene', 'camera', 'renderer',
      // DSL type constructors (may appear as calls)
      'vec2', 'vec3', 'color',
      // Other
      'undefined',
    ];
    for (const g of runtimeGlobals) {
      this._scope.define(g, 'runtime', null);
    }

    this._visitProgram(ast);
    return { ast, errors: this._errors.slice(), warnings: this._warnings.slice() };
  }

  // ── Scope helpers ─────────────────────────────────────────────────────────────

  _pushScope(kind) {
    this._scope = new Scope(this._scope, kind);
  }

  _popScope() {
    this._scope = this._scope.parent;
  }

  _define(name, kind, node) {
    if (!this._scope.define(name, kind, node)) {
      this._error(`Duplicate declaration of '${name}'`, node);
    }
  }

  _lookup(name, node) {
    const entry = this._scope.lookup(name);
    if (!entry) {
      this._warn(`Use of possibly-undeclared identifier '${name}'`, node);
    }
    return entry;
  }

  _error(msg, node) {
    this._errors.push({
      message: msg,
      line:    node ? node.line : 0,
      col:     node ? node.col  : 0,
    });
  }

  _warn(msg, node) {
    this._warnings.push({
      message: msg,
      line:    node ? node.line : 0,
      col:     node ? node.col  : 0,
    });
  }

  // ── Visitors ──────────────────────────────────────────────────────────────────

  _visitProgram(node) {
    // Hoist function names so forward calls resolve
    for (const stmt of node.body) {
      if (stmt.type === 'FnDef') {
        if (!this._scope.define(stmt.name, 'function', stmt)) {
          this._error(`Duplicate function name '${stmt.name}'`, stmt);
        }
      }
    }
    for (const stmt of node.body) {
      this._visitNode(stmt);
    }
  }

  _visitNode(node) {
    if (!node) return;
    switch (node.type) {
      case 'UseStmt':      return; // no semantic work needed
      case 'FnDef':        return this._visitFnDef(node);
      case 'VarDecl':      return this._visitVarDecl(node);
      case 'Assign':       return this._visitAssign(node);
      case 'IfStmt':       return this._visitIfStmt(node);
      case 'LoopStmt':     return this._visitLoopStmt(node);
      case 'EveryStmt':    return this._visitEveryStmt(node);
      case 'ReturnStmt':   return this._visitReturnStmt(node);
      case 'ExprStmt':     return this._visitNode(node.expr);
      // Expressions
      case 'BinaryExpr':   return this._visitBinaryExpr(node);
      case 'UnaryExpr':    return this._visitNode(node.operand);
      case 'CallExpr':     return this._visitCallExpr(node);
      case 'MemberExpr':   return this._visitNode(node.object);
      case 'IndexExpr':    this._visitNode(node.object); this._visitNode(node.index); return;
      case 'ArrayLiteral': node.elements.forEach(e => this._visitNode(e)); return;
      case 'ObjectLiteral': node.properties.forEach(p => this._visitNode(p.value)); return;
      case 'Identifier':   return this._lookup(node.name, node);
      // Literals — no work needed
      case 'NumberLiteral':
      case 'StringLiteral':
      case 'BoolLiteral':
      case 'NullLiteral':
        return;
      default:
        // Unknown node — skip gracefully
        break;
    }
  }

  _visitFnDef(node) {
    // Name already hoisted; just check body
    this._pushScope('function');
    for (const param of node.params) {
      this._scope.define(param.name, 'param', node);
    }
    for (const stmt of node.body) {
      this._visitNode(stmt);
    }
    this._popScope();
  }

  _visitVarDecl(node) {
    // Visit init expression first (so RHS can't reference the variable being declared)
    this._visitNode(node.init);

    // Type annotation check: detect obvious mismatches on literal inits
    if (node.typeName) {
      const inferredType = this._inferLiteralType(node.init);
      if (inferredType && !this._typesCompatible(node.typeName, inferredType)) {
        this._warn(
          `Type mismatch: variable '${node.name}' declared as '${node.typeName}' but initialized with ${inferredType} value`,
          node
        );
      }
    }

    this._define(node.name, 'let', node);
  }

  _visitAssign(node) {
    // Check that root variable exists
    const rootName = node.target[0];
    this._lookup(rootName, node);
    this._visitNode(node.value);
  }

  _visitIfStmt(node) {
    this._visitNode(node.test);
    this._pushScope('block');
    node.consequent.forEach(s => this._visitNode(s));
    this._popScope();
    if (node.alternate) {
      this._pushScope('block');
      if (Array.isArray(node.alternate)) {
        node.alternate.forEach(s => this._visitNode(s));
      }
      this._popScope();
    }
  }

  _visitLoopStmt(node) {
    this._visitNode(node.from);
    this._visitNode(node.to);
    this._pushScope('block');
    // Loop variable is scoped to the loop body
    this._scope.define(node.varName, 'loop-var', node);
    node.body.forEach(s => this._visitNode(s));
    this._popScope();
  }

  _visitEveryStmt(node) {
    this._visitNode(node.interval);
    this._pushScope('block');
    node.body.forEach(s => this._visitNode(s));
    this._popScope();
  }

  _visitReturnStmt(node) {
    if (!this._scope.findFunction()) {
      this._error("'return' used outside of a function", node);
    }
    if (node.value) this._visitNode(node.value);
  }

  _visitBinaryExpr(node) {
    this._visitNode(node.left);
    this._visitNode(node.right);
  }

  _visitCallExpr(node) {
    this._visitNode(node.callee);
    node.args.forEach(a => this._visitNode(a));
  }

  // ── Type helpers ──────────────────────────────────────────────────────────────

  /** Returns a rough type string for a literal node, or null if uncertain. */
  _inferLiteralType(node) {
    if (!node) return null;
    switch (node.type) {
      case 'NumberLiteral': return 'num';
      case 'BoolLiteral':   return 'bool';
      case 'StringLiteral': return 'str';
      case 'NullLiteral':   return 'null';
      default:              return null;
    }
  }

  _typesCompatible(declared, inferred) {
    if (declared === inferred) return true;
    // null is compatible with any reference type
    if (inferred === 'null') return true;
    // num is compatible with vec2/vec3/color (common DSL pattern)
    if (inferred === 'num' && (declared === 'vec2' || declared === 'vec3' || declared === 'color')) return true;
    return false;
  }
}
