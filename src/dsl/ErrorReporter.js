/**
 * Artlab DSL Error Reporter
 * Formats error/warning messages with source code snippets and caret pointers.
 */

// ─── ArtlabError ─────────────────────────────────────────────────────────────

export class ArtlabError extends Error {
  /**
   * @param {string} message  - Error description
   * @param {number} [line]   - 1-based line number
   * @param {number} [col]    - 1-based column number
   * @param {string} [source] - Full source text
   */
  constructor(message, line, col, source) {
    super(message);
    this.name   = 'ArtlabError';
    this.line   = line   || 0;
    this.col    = col    || 0;
    this.source = source || '';
  }
}

// ─── ErrorReporter ───────────────────────────────────────────────────────────

export class ErrorReporter {
  /**
   * Formats a list of error/warning objects into a human-readable string.
   *
   * Each item in `errors` must have: { message, line?, col? }
   * The optional `src` is the original source text used to extract the
   * offending line and render a caret pointer.
   *
   * Example output:
   *   error: Undefined variable 'foo'
   *    --> line 5, col 12
   *     4 | let bar = 1
   *     5 |   foo + bar
   *              ^
   *     6 | }
   *
   * @param {Array<{message: string, line?: number, col?: number}>} errors
   * @param {string} [src] - Source code (optional)
   * @returns {string}
   */
  format(errors, src) {
    if (!errors || errors.length === 0) return '';
    const srcLines = src ? src.split('\n') : [];

    return errors.map(e => this._formatOne(e, srcLines)).join('\n\n');
  }

  _formatOne(e, srcLines) {
    const lines = [];
    const label = e.severity === 'warning' ? 'warning' : 'error';
    lines.push(`${label}: ${e.message}`);

    const lineNo = e.line || 0;
    const colNo  = e.col  || 0;

    if (lineNo > 0) {
      lines.push(` --> line ${lineNo}, col ${colNo}`);

      if (srcLines.length > 0) {
        const idx     = lineNo - 1;
        const lineText = srcLines[idx] || '';
        const numW    = String(lineNo + 1).length; // width for line numbers

        lines.push(`${' '.repeat(numW + 1)}|`);

        // Previous line for context
        if (idx > 0) {
          const prevNum = String(lineNo - 1).padStart(numW, ' ');
          lines.push(`${prevNum} | ${srcLines[idx - 1]}`);
        }

        const curNum = String(lineNo).padStart(numW, ' ');
        lines.push(`${curNum} | ${lineText}`);

        // Caret pointer
        const caretOffset = Math.max(0, colNo - 1);
        lines.push(`${' '.repeat(numW + 1)}| ${' '.repeat(caretOffset)}^`);

        // Next line for context
        if (idx < srcLines.length - 1) {
          const nextNum = String(lineNo + 1).padStart(numW, ' ');
          lines.push(`${nextNum} | ${srcLines[idx + 1]}`);
        }

        lines.push(`${' '.repeat(numW + 1)}|`);
      }
    }

    return lines.join('\n');
  }
}
