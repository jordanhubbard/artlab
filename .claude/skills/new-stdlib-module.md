---
name: new-stdlib-module
description: Add a new module to the Artlab stdlib (src/stdlib/)
---

Add a new module to `src/stdlib/` by following these steps in order.

## Step 1 — Create the module file

Create `src/stdlib/<module>.js` using this template:

```js
/**
 * artlab/<module> — short description of what this module provides
 *
 * Longer description if needed — keep it to 2–3 sentences max.
 */

import * as THREE from 'three'

// ---------------------------------------------------------------------------
// <Section name>
// ---------------------------------------------------------------------------

/** One-line description of what this function does. */
export function doSomething(arg1, arg2 = defaultValue) {
  // implementation
}

/** One-line description. */
export function doSomethingElse(arg) {
  // implementation
}
```

### Style rules — read before writing any code

**Functions, not classes.** Export plain functions. A class is acceptable only
when it carries genuinely mutable state that functions cannot model cleanly.
When in doubt, use functions.

**One-line JSDoc on every export.** No `@param` or `@returns` blocks unless the
signature is genuinely ambiguous after reading the function name and parameter
names. The JSDoc line goes directly above the `export function` line.

**No side effects at import time.** The module must be safe to `import` in a
Node.js test environment without a DOM, a canvas, or a running renderer. Do
not call `document`, `window`, `navigator`, or any Three.js renderer at the
top level. Lazy-initialize anything that needs the browser inside the functions
that use it.

**Must work in both contexts.** The module is consumed by `StandaloneRunner`
(full-screen canvas) and `PreviewPane` (IDE sandbox). Do not assume either
context's internal structure is available.

**No backwards-compat shims or feature flags.** If you change a function
signature, update all call sites.

## Step 2 — Add tests

Create `src/stdlib/__tests__/<module>.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { doSomething, doSomethingElse } from '../<module>.js'

describe('<module>', () => {
  describe('doSomething', () => {
    it('returns expected value for typical input', () => {
      expect(doSomething(1, 2)).toBe(3)
    })

    it('handles edge case: zero', () => {
      expect(doSomething(0, 0)).toBe(0)
    })
  })

  describe('doSomethingElse', () => {
    it('uses default argument correctly', () => {
      expect(doSomethingElse(5)).toMatchObject({ /* ... */ })
    })
  })
})
```

Stdlib functions are pure utilities — no mock ctx needed. Import and call them
directly. Run `npm test` to confirm all tests pass before continuing.

## Step 3 — Update `docs/stdlib.html`

Open `docs/stdlib.html` and add a documentation section for the new module.
Follow the pattern of existing sections in that file:

- Add a heading with the module name.
- List each exported function with its signature and a one-sentence description.
- Include a small usage snippet showing the most common call pattern.

Do not add a separate `.md` file — the HTML doc is the canonical reference.

## Step 4 — Add a demonstrating example

Create at least one new example (or extend an existing one) that demonstrates
the new module in action. Follow the `new-example` skill for the full process.

The example should:
- Import the new module via `../../src/stdlib/<module>.js`
- Exercise the exported functions in a way that is visually obvious
- Be at the basic tier (< 100 lines) unless the module inherently requires more

This step is required — a stdlib module with no example is harder to
understand and harder to test end-to-end.

## Checklist before committing

- [ ] Module file is in `src/stdlib/<module>.js`
- [ ] Every exported function has a one-line JSDoc comment
- [ ] No side effects at import time (safe to import in Node.js without a DOM)
- [ ] Tests exist at `src/stdlib/__tests__/<module>.test.js` and pass (`npm test`)
- [ ] `docs/stdlib.html` has a new section for the module
- [ ] At least one example demonstrates the module

## Push

```bash
git add src/stdlib/<module>.js src/stdlib/__tests__/<module>.test.js docs/stdlib.html
git add examples/<demo-name>/   # if you added an example
git commit -m "stdlib: add <module> module"
git push
```

If this work closes a `bd` issue:

```bash
bd close <id> --reason "Added <module> to stdlib"
```
