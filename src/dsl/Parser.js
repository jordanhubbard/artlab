/**
 * Artlab DSL Parser
 * Recursive-descent parser that builds an AST from a Token array.
 *
 * Grammar (abbreviated):
 *   program     ::= stmt*
 *   stmt        ::= use_stmt | fn_def | var_decl | assign | if_stmt
 *                 | loop_stmt | every_stmt | return_stmt | expr_stmt
 *   use_stmt    ::= 'use' (string | 'url' ':' string | 'embedded' ':' string)
 *   fn_def      ::= 'fn' IDENT '(' params? ')' block
 *   var_decl    ::= 'let' IDENT (':' TYPE)? '=' expr
 *   assign      ::= IDENT ('.' IDENT)* '=' expr
 *   if_stmt     ::= 'if' expr block ('else' block)?
 *   loop_stmt   ::= 'loop' IDENT 'from' expr 'to' expr block
 *   every_stmt  ::= 'every' expr block
 *   return_stmt ::= 'return' expr?
 *   expr_stmt   ::= expr
 *   block       ::= '{' stmt* '}'
 */

import { TokenType } from './Lexer.js';

// ─── AST node factory ─────────────────────────────────────────────────────────

function node(type, props) {
  return Object.assign({ type }, props);
}

// ─── Parser ───────────────────────────────────────────────────────────────────

export class Parser {
  /**
   * @param {import('./Lexer.js').Token[]} tokens
   */
  constructor(tokens) {
    this.tokens = tokens;
    this.pos    = 0;
  }

  // ── Error helpers ─────────────────────────────────────────────────────────────

  _error(msg, tok) {
    const t   = tok || this._peek();
    const err = new Error(msg);
    err.line  = t.line;
    err.col   = t.col;
    throw err;
  }

  _expected(what, tok) {
    const t   = tok || this._peek();
    const got = t.type === TokenType.EOF
      ? 'end of file'
      : `'${t.value !== null && t.value !== undefined ? t.value : t.type}'`;
    this._error(`Expected ${what} but got ${got} at line ${t.line}, col ${t.col}`, t);
  }

  // ── Token access ──────────────────────────────────────────────────────────────

  _peek(offset = 0) {
    const i = this.pos + offset;
    return this.tokens[Math.min(i, this.tokens.length - 1)];
  }

  _advance() {
    const t = this.tokens[this.pos];
    if (t.type !== TokenType.EOF) this.pos++;
    return t;
  }

  _check(type) {
    return this._peek().type === type;
  }

  _match(...types) {
    for (const type of types) {
      if (this._check(type)) return this._advance();
    }
    return null;
  }

  _expect(type, description) {
    if (this._check(type)) return this._advance();
    this._expected(description || type, this._peek());
  }

  _isAtEnd() {
    return this._peek().type === TokenType.EOF;
  }

  // ── Public API ────────────────────────────────────────────────────────────────

  /**
   * Parses the full token stream.
   * @returns {{ type: 'Program', body: Array }}
   */
  parse() {
    const body = [];
    while (!this._isAtEnd()) {
      body.push(this._parseStmt());
    }
    return node('Program', { body });
  }

  // ── Statement dispatcher ──────────────────────────────────────────────────────

  _parseStmt() {
    const tok = this._peek();

    switch (tok.type) {
      case TokenType.USE:    return this._parseUseStmt();
      case TokenType.FN:     return this._parseFnDef();
      case TokenType.LET:    return this._parseVarDecl();
      case TokenType.IF:     return this._parseIfStmt();
      case TokenType.LOOP:   return this._parseLoopStmt();
      case TokenType.EVERY:  return this._parseEveryStmt();
      case TokenType.RETURN: return this._parseReturnStmt();

      case TokenType.IDENT: {
        // Look ahead: if IDENT (. IDENT)* = expr → assignment
        // Otherwise it's an expression statement.
        if (this._isAssignment()) return this._parseAssign();
        return this._parseExprStmt();
      }

      default:
        return this._parseExprStmt();
    }
  }

  /** Detect: IDENT (.IDENT)* = expr (not ==) */
  _isAssignment() {
    let offset = 1;
    // Skip over dot-chained idents
    while (
      this._peek(offset).type === TokenType.DOT &&
      this._peek(offset + 1).type === TokenType.IDENT
    ) {
      offset += 2;
    }
    const next = this._peek(offset);
    return next.type === TokenType.EQ;
  }

  // ── use statement ─────────────────────────────────────────────────────────────
  // use "artlab/geometry"
  // use url:"https://..."
  // use embedded:"libs/..."

  _parseUseStmt() {
    const tok = this._expect(TokenType.USE, "'use'");
    const line = tok.line;
    const col  = tok.col;

    // url:"..." or embedded:"..."
    if (this._check(TokenType.IDENT)) {
      const kw = this._peek().value;
      if (kw === 'url' || kw === 'embedded') {
        this._advance(); // consume 'url'/'embedded'
        this._expect(TokenType.COLON, "':'");
        const pathTok = this._expect(TokenType.STRING, 'path string');
        return node('UseStmt', { kind: kw, path: pathTok.value, line, col });
      }
    }

    // Plain string: use "artlab/geometry"
    const pathTok = this._expect(TokenType.STRING, 'module path string');
    return node('UseStmt', { kind: 'stdlib', path: pathTok.value, line, col });
  }

  // ── fn definition ─────────────────────────────────────────────────────────────

  _parseFnDef() {
    const tok = this._expect(TokenType.FN, "'fn'");
    const nameTok = this._expect(TokenType.IDENT, 'function name');
    this._expect(TokenType.LPAREN, "'('");

    const params = [];
    if (!this._check(TokenType.RPAREN)) {
      params.push(this._parseParam());
      while (this._match(TokenType.COMMA)) {
        params.push(this._parseParam());
      }
    }
    this._expect(TokenType.RPAREN, "')'");

    const body = this._parseBlock();
    return node('FnDef', {
      name: nameTok.value,
      params,
      body,
      line: tok.line,
      col:  tok.col,
    });
  }

  _parseParam() {
    const nameTok = this._expect(TokenType.IDENT, 'parameter name');
    let typeName = null;
    if (this._match(TokenType.COLON)) {
      const typeTok = this._expect(TokenType.TYPE, 'type name');
      typeName = typeTok.value;
    }
    return { name: nameTok.value, typeName };
  }

  // ── var declaration: let x (:TYPE)? = expr ────────────────────────────────────

  _parseVarDecl() {
    const tok = this._expect(TokenType.LET, "'let'");
    const nameTok = this._expect(TokenType.IDENT, 'variable name');

    let typeName = null;
    if (this._match(TokenType.COLON)) {
      const typeTok = this._expect(TokenType.TYPE, 'type name');
      typeName = typeTok.value;
    }

    this._expect(TokenType.EQ, "'='");
    const init = this._parseExpr();

    return node('VarDecl', {
      name: nameTok.value,
      typeName,
      init,
      line: tok.line,
      col:  tok.col,
    });
  }

  // ── assignment: IDENT (.IDENT)* = expr ───────────────────────────────────────

  _parseAssign() {
    const firstTok = this._expect(TokenType.IDENT, 'identifier');
    const parts    = [firstTok.value];

    while (this._check(TokenType.DOT)) {
      this._advance(); // .
      parts.push(this._expect(TokenType.IDENT, 'property name').value);
    }

    this._expect(TokenType.EQ, "'='");
    const value = this._parseExpr();

    return node('Assign', {
      target: parts,
      value,
      line: firstTok.line,
      col:  firstTok.col,
    });
  }

  // ── if statement ──────────────────────────────────────────────────────────────

  _parseIfStmt() {
    const tok = this._expect(TokenType.IF, "'if'");
    const test = this._parseExpr();
    const consequent = this._parseBlock();

    let alternate = null;
    if (this._match(TokenType.ELSE)) {
      // Support else-if chaining
      if (this._check(TokenType.IF)) {
        alternate = [this._parseIfStmt()];
      } else {
        alternate = this._parseBlock();
      }
    }

    return node('IfStmt', {
      test,
      consequent,
      alternate,
      line: tok.line,
      col:  tok.col,
    });
  }

  // ── loop statement: loop i from expr to expr block ───────────────────────────

  _parseLoopStmt() {
    const tok     = this._expect(TokenType.LOOP, "'loop'");
    const varTok  = this._expect(TokenType.IDENT, 'loop variable');
    this._expect(TokenType.FROM, "'from'");
    const from    = this._parseExpr();
    this._expect(TokenType.TO, "'to'");
    const to      = this._parseExpr();
    const body    = this._parseBlock();

    return node('LoopStmt', {
      varName: varTok.value,
      from,
      to,
      body,
      line: tok.line,
      col:  tok.col,
    });
  }

  // ── every statement: every expr block ────────────────────────────────────────

  _parseEveryStmt() {
    const tok      = this._expect(TokenType.EVERY, "'every'");
    const interval = this._parseExpr();
    const body     = this._parseBlock();

    return node('EveryStmt', {
      interval,
      body,
      line: tok.line,
      col:  tok.col,
    });
  }

  // ── return statement ──────────────────────────────────────────────────────────

  _parseReturnStmt() {
    const tok = this._expect(TokenType.RETURN, "'return'");

    // No value if next is } or EOF
    let value = null;
    if (!this._check(TokenType.RBRACE) && !this._isAtEnd()) {
      value = this._parseExpr();
    }

    return node('ReturnStmt', { value, line: tok.line, col: tok.col });
  }

  // ── expression statement ──────────────────────────────────────────────────────

  _parseExprStmt() {
    const expr = this._parseExpr();
    this._match(TokenType.SEMICOLON); // optional semicolon
    return node('ExprStmt', { expr, line: expr.line, col: expr.col });
  }

  // ── block: '{' stmt* '}' ─────────────────────────────────────────────────────

  _parseBlock() {
    this._expect(TokenType.LBRACE, "'{'");
    const stmts = [];
    while (!this._check(TokenType.RBRACE) && !this._isAtEnd()) {
      stmts.push(this._parseStmt());
    }
    this._expect(TokenType.RBRACE, "'}'");
    return stmts;
  }

  // ── Expressions (recursive descent / Pratt-style) ────────────────────────────

  _parseExpr() {
    return this._parseLogicalOr();
  }

  _parseLogicalOr() {
    let left = this._parseLogicalAnd();
    while (this._check(TokenType.OR)) {
      const op = this._advance().value;
      left = node('BinaryExpr', { op, left, right: this._parseLogicalAnd(), line: left.line, col: left.col });
    }
    return left;
  }

  _parseLogicalAnd() {
    let left = this._parseEquality();
    while (this._check(TokenType.AND)) {
      const op = this._advance().value;
      left = node('BinaryExpr', { op, left, right: this._parseEquality(), line: left.line, col: left.col });
    }
    return left;
  }

  _parseEquality() {
    let left = this._parseRelational();
    while (this._check(TokenType.EQEQ) || this._check(TokenType.NEQ)) {
      const op = this._advance().value;
      left = node('BinaryExpr', { op, left, right: this._parseRelational(), line: left.line, col: left.col });
    }
    return left;
  }

  _parseRelational() {
    let left = this._parseAdditive();
    while (
      this._check(TokenType.LT)  || this._check(TokenType.GT) ||
      this._check(TokenType.LTE) || this._check(TokenType.GTE)
    ) {
      const op = this._advance().value;
      left = node('BinaryExpr', { op, left, right: this._parseAdditive(), line: left.line, col: left.col });
    }
    return left;
  }

  _parseAdditive() {
    let left = this._parseMultiplicative();
    while (this._check(TokenType.PLUS) || this._check(TokenType.MINUS)) {
      const op = this._advance().value;
      left = node('BinaryExpr', { op, left, right: this._parseMultiplicative(), line: left.line, col: left.col });
    }
    return left;
  }

  _parseMultiplicative() {
    let left = this._parseUnary();
    while (
      this._check(TokenType.STAR)    ||
      this._check(TokenType.SLASH)   ||
      this._check(TokenType.PERCENT)
    ) {
      const op = this._advance().value;
      left = node('BinaryExpr', { op, left, right: this._parseUnary(), line: left.line, col: left.col });
    }
    return left;
  }

  _parseUnary() {
    if (this._check(TokenType.BANG) || this._check(TokenType.MINUS)) {
      const opTok = this._advance();
      return node('UnaryExpr', {
        op:      opTok.value,
        operand: this._parseUnary(),
        line:    opTok.line,
        col:     opTok.col,
      });
    }
    return this._parseCallOrMember();
  }

  // ── Call / member access / primary ───────────────────────────────────────────

  _parseCallOrMember() {
    let expr = this._parsePrimary();

    // Postfix: call or member
    for (;;) {
      if (this._check(TokenType.LPAREN)) {
        // Call expression
        this._advance(); // (
        const args = this._check(TokenType.RPAREN) ? [] : this._parseArgList();
        this._expect(TokenType.RPAREN, "')'");
        expr = node('CallExpr', { callee: expr, args, line: expr.line, col: expr.col });
      } else if (this._check(TokenType.DOT)) {
        // Member expression
        this._advance(); // .
        const propTok = this._expect(TokenType.IDENT, 'property name');
        expr = node('MemberExpr', {
          object:   expr,
          property: propTok.value,
          line:     propTok.line,
          col:      propTok.col,
        });
      } else if (this._check(TokenType.LBRACKET)) {
        // Computed member: expr[expr]
        this._advance(); // [
        const index = this._parseExpr();
        this._expect(TokenType.RBRACKET, "']'");
        expr = node('IndexExpr', { object: expr, index, line: expr.line, col: expr.col });
      } else {
        break;
      }
    }

    return expr;
  }

  _parsePrimary() {
    const tok = this._peek();

    if (tok.type === TokenType.NUMBER) {
      this._advance();
      return node('NumberLiteral', { value: tok.value, line: tok.line, col: tok.col });
    }

    if (tok.type === TokenType.STRING) {
      this._advance();
      return node('StringLiteral', { value: tok.value, line: tok.line, col: tok.col });
    }

    if (tok.type === TokenType.TRUE || tok.type === TokenType.FALSE) {
      this._advance();
      return node('BoolLiteral', { value: tok.value, line: tok.line, col: tok.col });
    }

    if (tok.type === TokenType.NULL) {
      this._advance();
      return node('NullLiteral', { line: tok.line, col: tok.col });
    }

    if (tok.type === TokenType.IDENT) {
      this._advance();
      return node('Identifier', { name: tok.value, line: tok.line, col: tok.col });
    }

    // Type keywords used as constructor: vec3(1,2,3), color(1,0,0)
    if (tok.type === TokenType.TYPE) {
      this._advance();
      return node('Identifier', { name: tok.value, line: tok.line, col: tok.col });
    }

    if (tok.type === TokenType.LPAREN) {
      this._advance(); // (
      const inner = this._parseExpr();
      this._expect(TokenType.RPAREN, "')'");
      return inner;
    }

    if (tok.type === TokenType.LBRACKET) {
      return this._parseArrayLiteral();
    }

    if (tok.type === TokenType.LBRACE) {
      return this._parseObjectLiteral();
    }

    this._error(
      `Unexpected token '${tok.value !== null && tok.value !== undefined ? tok.value : tok.type}' at line ${tok.line}, col ${tok.col} — expected an expression`,
      tok
    );
  }

  // ── Array literal: [ expr, ... ] ──────────────────────────────────────────────

  _parseArrayLiteral() {
    const tok  = this._expect(TokenType.LBRACKET, "'['");
    const elements = [];
    if (!this._check(TokenType.RBRACKET)) {
      elements.push(this._parseExpr());
      while (this._match(TokenType.COMMA)) {
        if (this._check(TokenType.RBRACKET)) break; // trailing comma
        elements.push(this._parseExpr());
      }
    }
    this._expect(TokenType.RBRACKET, "']'");
    return node('ArrayLiteral', { elements, line: tok.line, col: tok.col });
  }

  // ── Object literal: { key: expr, ... } ───────────────────────────────────────

  _parseObjectLiteral() {
    const tok  = this._expect(TokenType.LBRACE, "'{'");
    const properties = [];
    while (!this._check(TokenType.RBRACE) && !this._isAtEnd()) {
      const keyTok = this._peek();
      // Accept IDENT or STRING as key
      if (keyTok.type !== TokenType.IDENT && keyTok.type !== TokenType.STRING) {
        this._error(`Expected property key (identifier or string) but got '${keyTok.value}'`, keyTok);
      }
      this._advance();
      this._expect(TokenType.COLON, "':'");
      const value = this._parseExpr();
      properties.push({ key: keyTok.value, value });
      if (!this._match(TokenType.COMMA)) break;
    }
    this._expect(TokenType.RBRACE, "'}'");
    return node('ObjectLiteral', { properties, line: tok.line, col: tok.col });
  }

  // ── Argument list ─────────────────────────────────────────────────────────────

  _parseArgList() {
    const args = [this._parseExpr()];
    while (this._match(TokenType.COMMA)) {
      if (this._check(TokenType.RPAREN)) break; // trailing comma
      args.push(this._parseExpr());
    }
    return args;
  }
}
