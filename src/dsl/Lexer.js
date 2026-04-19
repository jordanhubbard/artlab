/**
 * Artlab DSL Lexer
 * Tokenizes Artlab DSL source into a flat Token array.
 *
 * Grammar keywords: use, fn, let, if, else, loop, from, to, every, return,
 *                   true, false, null
 * Type keywords:    num, vec2, vec3, color, bool, str, mesh, scene
 */

// ─── Token Types ─────────────────────────────────────────────────────────────

export const TokenType = Object.freeze({
  // Keywords
  USE:    'USE',
  FN:     'FN',
  LET:    'LET',
  IF:     'IF',
  ELSE:   'ELSE',
  LOOP:   'LOOP',
  FROM:   'FROM',
  TO:     'TO',
  EVERY:  'EVERY',
  RETURN: 'RETURN',
  TRUE:   'TRUE',
  FALSE:  'FALSE',
  NULL:   'NULL',

  // Type keywords
  TYPE:   'TYPE',   // num, vec2, vec3, color, bool, str, mesh, scene

  // Literals
  NUMBER: 'NUMBER',
  STRING: 'STRING',

  // Identifiers
  IDENT:  'IDENT',

  // Operators
  PLUS:   'PLUS',    // +
  MINUS:  'MINUS',   // -
  STAR:   'STAR',    // *
  SLASH:  'SLASH',   // /
  PERCENT:'PERCENT', // %
  EQ:     'EQ',      // =
  EQEQ:   'EQEQ',   // ==
  NEQ:    'NEQ',     // !=
  LT:     'LT',      // <
  GT:     'GT',      // >
  LTE:    'LTE',     // <=
  GTE:    'GTE',     // >=
  AND:    'AND',     // &&
  OR:     'OR',      // ||
  BANG:   'BANG',    // !

  // Delimiters
  LBRACE:   'LBRACE',    // {
  RBRACE:   'RBRACE',    // }
  LPAREN:   'LPAREN',    // (
  RPAREN:   'RPAREN',    // )
  LBRACKET: 'LBRACKET',  // [
  RBRACKET: 'RBRACKET',  // ]
  COLON:    'COLON',     // :
  COMMA:    'COMMA',     // ,
  DOT:      'DOT',       // .
  SEMICOLON:'SEMICOLON', // ;

  // Special
  EOF: 'EOF',
});

// Keywords mapping: lowercase source word → TokenType
const KEYWORDS = new Map([
  ['use',    TokenType.USE],
  ['fn',     TokenType.FN],
  ['let',    TokenType.LET],
  ['if',     TokenType.IF],
  ['else',   TokenType.ELSE],
  ['loop',   TokenType.LOOP],
  ['from',   TokenType.FROM],
  ['to',     TokenType.TO],
  ['every',  TokenType.EVERY],
  ['return', TokenType.RETURN],
  ['true',   TokenType.TRUE],
  ['false',  TokenType.FALSE],
  ['null',   TokenType.NULL],
]);

// Type keyword set — tokenized as TYPE tokens
const TYPE_KEYWORDS = new Set(['num', 'vec2', 'vec3', 'color', 'bool', 'str', 'mesh', 'scene']);

// ─── Token ────────────────────────────────────────────────────────────────────

export class Token {
  /**
   * @param {string} type  - One of TokenType constants
   * @param {*}      value - Parsed value (string, number, boolean, null)
   * @param {number} line  - 1-based line number
   * @param {number} col   - 1-based column number
   */
  constructor(type, value, line, col) {
    this.type  = type;
    this.value = value;
    this.line  = line;
    this.col   = col;
  }

  toString() {
    return `Token(${this.type}, ${JSON.stringify(this.value)}, ${this.line}:${this.col})`;
  }
}

// ─── Lexer ────────────────────────────────────────────────────────────────────

export class Lexer {
  /**
   * @param {string} src - Source code string
   */
  constructor(src) {
    this.src    = src;
    this.pos    = 0;
    this.line   = 1;
    this.col    = 1;
    this.tokens = [];
  }

  // ── Character access ────────────────────────────────────────────────────────

  _peek(offset = 0) {
    return this.src[this.pos + offset];
  }

  _advance() {
    const ch = this.src[this.pos++];
    if (ch === '\n') {
      this.line++;
      this.col = 1;
    } else {
      this.col++;
    }
    return ch;
  }

  _match(ch) {
    if (this.src[this.pos] === ch) {
      this._advance();
      return true;
    }
    return false;
  }

  _isAtEnd() {
    return this.pos >= this.src.length;
  }

  // ── Error helper ─────────────────────────────────────────────────────────────

  _error(msg, line, col) {
    const err = new Error(msg);
    err.line = line !== undefined ? line : this.line;
    err.col  = col  !== undefined ? col  : this.col;
    err.source = this.src;
    throw err;
  }

  // ── Public API ────────────────────────────────────────────────────────────────

  /**
   * Tokenizes the full source string.
   * @returns {Token[]}
   */
  tokenize() {
    while (!this._isAtEnd()) {
      this._skipWhitespaceAndComments();
      if (this._isAtEnd()) break;
      this._scanToken();
    }
    this.tokens.push(new Token(TokenType.EOF, null, this.line, this.col));
    return this.tokens;
  }

  // ── Skip whitespace and comments ─────────────────────────────────────────────

  _skipWhitespaceAndComments() {
    while (!this._isAtEnd()) {
      const ch = this._peek();

      if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
        this._advance();
        continue;
      }

      // Line comment: // ...
      if (ch === '/' && this._peek(1) === '/') {
        while (!this._isAtEnd() && this._peek() !== '\n') this._advance();
        continue;
      }

      // Block comment: /* ... */
      if (ch === '/' && this._peek(1) === '*') {
        const sl = this.line;
        const sc = this.col;
        this._advance(); // /
        this._advance(); // *
        while (!this._isAtEnd()) {
          if (this._peek() === '*' && this._peek(1) === '/') {
            this._advance(); // *
            this._advance(); // /
            break;
          }
          this._advance();
        }
        if (this._isAtEnd()) {
          this._error('Unterminated block comment', sl, sc);
        }
        continue;
      }

      break;
    }
  }

  // ── Scan a single token ───────────────────────────────────────────────────────

  _scanToken() {
    const sl = this.line;
    const sc = this.col;
    const ch = this._advance();

    switch (ch) {
      case '{': this._emit(TokenType.LBRACE,    '{',  sl, sc); return;
      case '}': this._emit(TokenType.RBRACE,    '}',  sl, sc); return;
      case '(': this._emit(TokenType.LPAREN,    '(',  sl, sc); return;
      case ')': this._emit(TokenType.RPAREN,    ')',  sl, sc); return;
      case '[': this._emit(TokenType.LBRACKET,  '[',  sl, sc); return;
      case ']': this._emit(TokenType.RBRACKET,  ']',  sl, sc); return;
      case ',': this._emit(TokenType.COMMA,     ',',  sl, sc); return;
      case ';': this._emit(TokenType.SEMICOLON, ';',  sl, sc); return;
      case '.': this._emit(TokenType.DOT,       '.',  sl, sc); return;
      case '+': this._emit(TokenType.PLUS,      '+',  sl, sc); return;
      case '-': this._emit(TokenType.MINUS,     '-',  sl, sc); return;
      case '*': this._emit(TokenType.STAR,      '*',  sl, sc); return;
      case '%': this._emit(TokenType.PERCENT,   '%',  sl, sc); return;
      case ':': this._emit(TokenType.COLON,     ':',  sl, sc); return;

      case '/':
        // Comments already handled; this is division
        this._emit(TokenType.SLASH, '/', sl, sc);
        return;

      case '=':
        if (this._match('=')) {
          this._emit(TokenType.EQEQ, '==', sl, sc);
        } else {
          this._emit(TokenType.EQ, '=', sl, sc);
        }
        return;

      case '!':
        if (this._match('=')) {
          this._emit(TokenType.NEQ, '!=', sl, sc);
        } else {
          this._emit(TokenType.BANG, '!', sl, sc);
        }
        return;

      case '<':
        if (this._match('=')) {
          this._emit(TokenType.LTE, '<=', sl, sc);
        } else {
          this._emit(TokenType.LT, '<', sl, sc);
        }
        return;

      case '>':
        if (this._match('=')) {
          this._emit(TokenType.GTE, '>=', sl, sc);
        } else {
          this._emit(TokenType.GT, '>', sl, sc);
        }
        return;

      case '&':
        if (this._match('&')) {
          this._emit(TokenType.AND, '&&', sl, sc);
        } else {
          this._error(`Unexpected '&' — did you mean '&&'?`, sl, sc);
        }
        return;

      case '|':
        if (this._match('|')) {
          this._emit(TokenType.OR, '||', sl, sc);
        } else {
          this._error(`Unexpected '|' — did you mean '||'?`, sl, sc);
        }
        return;

      case '"':
        this._scanString(sl, sc);
        return;
    }

    if (this._isDigit(ch)) {
      this._scanNumber(ch, sl, sc);
      return;
    }

    if (this._isAlpha(ch)) {
      this._scanIdentOrKeyword(ch, sl, sc);
      return;
    }

    this._error(`Unexpected character '${ch}'`, sl, sc);
  }

  // ── Emit helper ────────────────────────────────────────────────────────────────

  _emit(type, value, line, col) {
    this.tokens.push(new Token(type, value, line, col));
  }

  // ── Character classification ───────────────────────────────────────────────────

  _isDigit(ch) {
    return ch >= '0' && ch <= '9';
  }

  _isAlpha(ch) {
    return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_';
  }

  _isAlphaNum(ch) {
    return this._isAlpha(ch) || this._isDigit(ch);
  }

  // ── String literal: "..." ──────────────────────────────────────────────────────

  _scanString(sl, sc) {
    let str = '';
    while (!this._isAtEnd() && this._peek() !== '"') {
      const c = this._peek();
      if (c === '\\') {
        this._advance(); // consume backslash
        const esc = this._advance();
        switch (esc) {
          case 'n':  str += '\n'; break;
          case 't':  str += '\t'; break;
          case 'r':  str += '\r'; break;
          case '"':  str += '"';  break;
          case '\\': str += '\\'; break;
          default:
            this._error(`Unknown escape sequence '\\${esc}'`);
        }
      } else if (c === '\n') {
        this._error('Unterminated string literal — newline in string', sl, sc);
      } else {
        str += this._advance();
      }
    }
    if (this._isAtEnd()) {
      this._error('Unterminated string literal', sl, sc);
    }
    this._advance(); // closing "
    this._emit(TokenType.STRING, str, sl, sc);
  }

  // ── Number literal: 123, 1.5, 1.0e-3 ─────────────────────────────────────────

  _scanNumber(firstChar, sl, sc) {
    let raw = firstChar;

    while (!this._isAtEnd() && this._isDigit(this._peek())) {
      raw += this._advance();
    }

    if (this._peek() === '.' && this._isDigit(this._peek(1) || '')) {
      raw += this._advance(); // '.'
      while (!this._isAtEnd() && this._isDigit(this._peek())) {
        raw += this._advance();
      }
    }

    if (this._peek() === 'e' || this._peek() === 'E') {
      raw += this._advance();
      if (this._peek() === '+' || this._peek() === '-') raw += this._advance();
      if (!this._isDigit(this._peek())) {
        this._error(`Invalid number literal '${raw}' — expected exponent digits`, sl, sc);
      }
      while (!this._isAtEnd() && this._isDigit(this._peek())) {
        raw += this._advance();
      }
    }

    this._emit(TokenType.NUMBER, parseFloat(raw), sl, sc);
  }

  // ── Identifier or keyword ──────────────────────────────────────────────────────

  _scanIdentOrKeyword(firstChar, sl, sc) {
    let name = firstChar;
    while (!this._isAtEnd() && this._isAlphaNum(this._peek())) {
      name += this._advance();
    }

    if (KEYWORDS.has(name)) {
      const kwType = KEYWORDS.get(name);
      if (kwType === TokenType.TRUE) {
        this._emit(TokenType.TRUE, true, sl, sc);
      } else if (kwType === TokenType.FALSE) {
        this._emit(TokenType.FALSE, false, sl, sc);
      } else if (kwType === TokenType.NULL) {
        this._emit(TokenType.NULL, null, sl, sc);
      } else {
        this._emit(kwType, name, sl, sc);
      }
    } else if (TYPE_KEYWORDS.has(name)) {
      this._emit(TokenType.TYPE, name, sl, sc);
    } else {
      this._emit(TokenType.IDENT, name, sl, sc);
    }
  }
}
