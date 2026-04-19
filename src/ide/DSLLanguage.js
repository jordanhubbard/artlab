/**
 * DSLLanguage — registers the Artlab DSL as a Monaco language.
 *
 * Call registerDSLLanguage(monaco) once after Monaco is loaded.
 * The language id is 'artlab'.
 */

export const ARTLAB_LANGUAGE_ID = 'artlab'

/**
 * Register the Artlab DSL language with a Monaco instance.
 * Safe to call multiple times (no-ops on duplicate registration).
 *
 * @param {typeof import('monaco-editor')} monaco
 */
export function registerDSLLanguage(monaco) {
  // Guard against double-registration
  const existing = monaco.languages.getLanguages().find(l => l.id === ARTLAB_LANGUAGE_ID)
  if (existing) return

  // ── 1. Register the language id ─────────────────────────────────────────
  monaco.languages.register({
    id:         ARTLAB_LANGUAGE_ID,
    extensions: ['.art'],
    aliases:    ['Artlab', 'artlab', 'ArtLab DSL'],
    mimetypes:  ['text/x-artlab'],
  })

  // ── 2. Tokenizer (Monarch) ───────────────────────────────────────────────
  monaco.languages.setMonarchTokensProvider(ARTLAB_LANGUAGE_ID, {
    defaultToken: 'invalid',

    keywords: [
      'fn', 'let', 'use', 'as', 'if', 'else', 'loop', 'from', 'to', 'by',
      'every', 'return', 'true', 'false', 'null', 'url', 'embedded',
    ],

    typeKeywords: [
      'num', 'bool', 'str',
      'vec2', 'vec3', 'vec4',
      'color', 'quat',
      'mesh', 'scene',
    ],

    builtinFunctions: [
      'setup', 'update', 'teardown',
      'sin', 'cos', 'tan', 'abs', 'sqrt', 'floor', 'ceil', 'round',
      'min', 'max', 'clamp', 'lerp', 'mod', 'pow', 'log', 'exp',
      'length', 'normalize', 'dot', 'cross', 'mix',
      'vec2', 'vec3', 'vec4', 'color', 'quat',
    ],

    operators: [
      '=', '==', '!=', '<', '>', '<=', '>=',
      '+', '-', '*', '/', '%', '**',
      '&&', '||', '!',
    ],

    symbols:  /[=><!~?:&|+\-*\/\^%]+/,
    escapes:  /\\(?:[btnfr\\"']|u[0-9A-Fa-f]{4})/,

    tokenizer: {
      root: [
        // Comments
        [/#.*$/, 'comment'],

        // Whitespace
        [/[ \t\r\n]+/, 'white'],

        // String literals
        [/"/, { token: 'string.quote', bracket: '@open', next: '@string' }],

        // Numbers
        [/\d+(\.\d+)?([eE][+-]?\d+)?/, 'number'],

        // Identifiers, keywords, types, builtins
        [/[a-zA-Z_]\w*/, {
          cases: {
            '@keywords':        'keyword',
            '@typeKeywords':    'type',
            '@builtinFunctions':'predefined',
            '@default':         'identifier',
          }
        }],

        // Operators and punctuation
        [/@symbols/, {
          cases: {
            '@operators': 'operator',
            '@default':   'delimiter',
          }
        }],

        // Brackets
        [/[{}()\[\]]/, '@brackets'],

        // Delimiter: comma, colon, semicolon
        [/[,;:]/, 'delimiter'],
      ],

      string: [
        [/[^\\"]+/,  'string'],
        [/@escapes/, 'string.escape'],
        [/\\./,      'string.escape.invalid'],
        [/"/,        { token: 'string.quote', bracket: '@close', next: '@pop' }],
      ],
    }
  })

  // ── 3. Language configuration ────────────────────────────────────────────
  monaco.languages.setLanguageConfiguration(ARTLAB_LANGUAGE_ID, {
    comments: {
      lineComment: '#',
    },

    brackets: [
      ['{', '}'],
      ['[', ']'],
      ['(', ')'],
    ],

    autoClosingPairs: [
      { open: '{',  close: '}' },
      { open: '[',  close: ']' },
      { open: '(',  close: ')' },
      { open: '"',  close: '"', notIn: ['string', 'comment'] },
    ],

    surroundingPairs: [
      { open: '{',  close: '}' },
      { open: '[',  close: ']' },
      { open: '(',  close: ')' },
      { open: '"',  close: '"' },
    ],

    indentationRules: {
      increaseIndentPattern: /^\s*(fn|if|else|loop|every)\b.*\{\s*$/,
      decreaseIndentPattern: /^\s*\}\s*$/,
    },

    folding: {
      markers: {
        start: /^\s*#\s*region\b/,
        end:   /^\s*#\s*endregion\b/,
      }
    },

    onEnterRules: [
      {
        // After opening brace on the same line as fn/if/loop/every
        beforeText: /^\s*(fn|if|else|loop|every)\b.*\{\s*$/,
        action: { indentAction: monaco.languages.IndentAction.Indent },
      }
    ],
  })

  // ── 4. Completion provider (basic keywords + snippets) ───────────────────
  monaco.languages.registerCompletionItemProvider(ARTLAB_LANGUAGE_ID, {
    provideCompletionItems(model, position) {
      const word  = model.getWordUntilPosition(position)
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber:   position.lineNumber,
        startColumn:     word.startColumn,
        endColumn:       word.endColumn,
      }

      const kw = (label, doc) => ({
        label,
        kind: monaco.languages.CompletionItemKind.Keyword,
        insertText: label,
        range,
        detail: doc,
      })

      const snip = (label, insertText, doc) => ({
        label,
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText,
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        range,
        detail: doc,
        documentation: doc,
      })

      return {
        suggestions: [
          // Keywords
          kw('fn',     'Define a function'),
          kw('let',    'Declare a variable'),
          kw('use',    'Import a dependency'),
          kw('if',     'Conditional'),
          kw('else',   'Else branch'),
          kw('loop',   'Numeric loop'),
          kw('every',  'Interval callback'),
          kw('return', 'Return from function'),
          kw('true',   'Boolean true'),
          kw('false',  'Boolean false'),
          kw('null',   'Null value'),

          // Types
          ...['num','bool','str','vec2','vec3','vec4','color','quat','mesh','scene']
            .map(t => ({ label: t, kind: monaco.languages.CompletionItemKind.TypeParameter, insertText: t, range })),

          // Snippets
          snip('fn setup', 'fn setup() {\n\t$0\n}',
               'Entry-point setup function called once'),
          snip('fn update', 'fn update(ctx, dt: num) {\n\t$0\n}',
               'Per-frame update function'),
          snip('fn teardown', 'fn teardown() {\n\t$0\n}',
               'Cleanup function called on unload'),
          snip('fn …', 'fn ${1:name}(${2:params}) {\n\t$0\n}',
               'Function definition'),
          snip('let …', 'let ${1:name}: ${2:num} = $0',
               'Variable declaration'),
          snip('if …', 'if ${1:condition} {\n\t$0\n}',
               'Conditional statement'),
          snip('if/else', 'if ${1:condition} {\n\t$0\n} else {\n\t\n}',
               'Conditional with else'),
          snip('loop …', 'loop ${1:i} from ${2:0} to ${3:10} {\n\t$0\n}',
               'Numeric loop'),
          snip('loop by', 'loop ${1:i} from ${2:0} to ${3:10} by ${4:1} {\n\t$0\n}',
               'Numeric loop with step'),
          snip('every …', 'every ${1:1.0} {\n\t$0\n}',
               'Interval callback'),
          snip('use stdlib', 'use "artlab/${1:math}"',
               'Import from stdlib'),
          snip('use url', 'use url:"${1:https://}"',
               'Import from URL'),
          snip('vec3(…)', 'vec3(${1:0}, ${2:0}, ${3:0})',
               'THREE.Vector3 constructor'),
          snip('color(…)', 'color(${1:1}, ${2:0}, ${3:0})',
               'THREE.Color constructor'),
        ]
      }
    }
  })

  // ── 5. Hover provider — show type info for keywords ──────────────────────
  const HOVER_DOCS = {
    fn:       '`fn name(params) [: TYPE] { … }` — define a function',
    let:      '`let name [: TYPE] = expr` — declare a variable',
    use:      '`use "artlab/…" [as alias]` — import a module',
    if:       '`if expr { … } [else { … }]` — conditional statement',
    loop:     '`loop i from start to end [by step] { … }` — numeric for-loop',
    every:    '`every seconds { … }` — repeated interval callback',
    return:   '`return [expr]` — return a value from a function',
    num:      'Built-in type: 64-bit float (maps to JS number)',
    bool:     'Built-in type: boolean',
    str:      'Built-in type: JS string',
    vec2:     'Built-in type / constructor: THREE.Vector2',
    vec3:     'Built-in type / constructor: THREE.Vector3',
    vec4:     'Built-in type / constructor: THREE.Vector4',
    color:    'Built-in type / constructor: THREE.Color',
    quat:     'Built-in type / constructor: THREE.Quaternion',
    mesh:     'Built-in type: THREE.Mesh scene object',
    scene:    'Built-in type: THREE.Scene or SceneNode',
    setup:    'Lifecycle: called once when the package is loaded',
    update:   'Lifecycle: called every frame with delta-time `dt` in seconds',
    teardown: 'Lifecycle: called when the package is unloaded',
  }

  monaco.languages.registerHoverProvider(ARTLAB_LANGUAGE_ID, {
    provideHover(model, position) {
      const word = model.getWordAtPosition(position)
      if (!word) return null
      const doc = HOVER_DOCS[word.word]
      if (!doc) return null
      return {
        range: new monaco.Range(
          position.lineNumber, word.startColumn,
          position.lineNumber, word.endColumn
        ),
        contents: [{ value: doc }],
      }
    }
  })
}
