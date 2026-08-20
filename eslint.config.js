import js from '@eslint/js'
import globals from 'globals'

export default [
  {
    ignores: [
      '.beads/**',
      '.codegraph/**',
      'dist/**',
      'node_modules/**',
      'packages/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: false,
    },
  },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      'no-empty': 'off',
      'no-unused-vars': 'off',
      'no-useless-assignment': 'off',
      'preserve-caught-error': 'off',
    },
  },
  {
    files: ['**/*.test.js', 'e2e/**/*.js'],
    languageOptions: {
      globals: globals.vitest,
    },
  },
]
