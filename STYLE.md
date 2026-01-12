# Code Style Guide

This document defines the coding standards for all `@motioneffector` libraries. Every module must follow these conventions to ensure consistency, maintainability, and portfolio-quality code.

---

## Table of Contents

1. [Project Structure](#1-project-structure)
2. [File Naming](#2-file-naming)
3. [TypeScript Conventions](#3-typescript-conventions)
4. [Function Design](#4-function-design)
5. [Error Handling](#5-error-handling)
6. [Testing Standards](#6-testing-standards)
7. [Documentation](#7-documentation)
8. [Formatting](#8-formatting)
9. [Imports & Exports](#9-imports--exports)
10. [Git Conventions](#10-git-conventions)

---

## 1. Project Structure

### 1.1 Directory Layout

```
package-name/
├── src/
│   ├── index.ts          # Public API entry point (exports only)
│   ├── core/             # Core implementation
│   │   ├── feature.ts
│   │   └── feature.test.ts
│   ├── utils/            # Internal utilities
│   │   ├── helpers.ts
│   │   └── helpers.test.ts
│   ├── errors.ts         # Custom error classes
│   └── types.ts          # Public type definitions
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts      # If separate from vite.config.ts
├── README.md             # Public documentation
├── TESTS.md              # Test specification
├── QUESTIONS.md          # Design decisions
└── CHANGELOG.md          # Version history
```

### 1.2 Colocation

Tests live next to the code they test. No separate `__tests__` directories.

```
src/
├── parser.ts
├── parser.test.ts        # Tests for parser.ts
├── validator.ts
└── validator.test.ts     # Tests for validator.ts
```

### 1.3 Index Files

The root `index.ts` is **exports only**. No implementation logic.

```typescript
// src/index.ts - CORRECT
export { createStore } from './core/store'
export { ParseError, ValidationError } from './errors'
export type { Store, StoreOptions } from './types'

// src/index.ts - WRONG
export function createStore() { /* implementation */ }
```

---

## 2. File Naming

### 2.1 General Rules

| Type | Convention | Example |
|------|------------|---------|
| Source files | `kebab-case.ts` | `flag-store.ts` |
| Test files | `kebab-case.test.ts` | `flag-store.test.ts` |
| Type-only files | `types.ts` or `feature.types.ts` | `store.types.ts` |
| Constants | `constants.ts` | `constants.ts` |
| React components | `PascalCase.tsx` | `ThemeProvider.tsx` |

### 2.2 Avoid Generic Names

```
# BAD
utils.ts
helpers.ts
index.ts (for non-entry points)

# GOOD
string-utils.ts
condition-parser.ts
```

### 2.3 One Concept Per File

Each file should have a single responsibility. If a file needs multiple sections of documentation, split it.

---

## 3. TypeScript Conventions

### 3.1 Strict Mode Required

All projects use strict TypeScript. These compiler options are mandatory:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true
  }
}
```

### 3.2 Type Annotations

**Explicit return types on exported functions:**

```typescript
// CORRECT - Exported function has explicit return type
export function parse(input: string): ParseResult {
  // ...
}

// CORRECT - Internal function can rely on inference
function normalizeKey(key: string) {
  return key.toLowerCase().trim()
}
```

**No `any`. Use `unknown` for truly unknown types:**

```typescript
// BAD
function process(data: any) { }

// GOOD
function process(data: unknown) {
  if (typeof data === 'string') { }
}
```

### 3.3 Type vs Interface

Use `type` for:
- Unions, intersections, mapped types
- Function signatures
- Primitive aliases

Use `interface` for:
- Object shapes that may be extended
- Public API contracts

```typescript
// Type for unions and functions
type Status = 'pending' | 'active' | 'completed'
type Parser = (input: string) => Result

// Interface for extensible object shapes
interface StoreOptions {
  persist?: boolean
  history?: boolean
}
```

### 3.4 Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Variables, functions | camelCase | `getUserName`, `isValid` |
| Types, interfaces | PascalCase | `UserProfile`, `StoreOptions` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_RETRIES`, `DEFAULT_TIMEOUT` |
| Generic parameters | Single capital letter or PascalCase | `T`, `TResult`, `TKey` |
| Private members | No underscore prefix | Use `#private` syntax or closure |
| Boolean variables | `is`, `has`, `can`, `should` prefix | `isActive`, `hasPermission` |

### 3.5 Enums

Prefer const objects over enums for better tree-shaking:

```typescript
// AVOID
enum Status {
  Pending = 'pending',
  Active = 'active',
}

// PREFER
const Status = {
  Pending: 'pending',
  Active: 'active',
} as const

type Status = typeof Status[keyof typeof Status]
```

### 3.6 Nullability

Be explicit about null vs undefined:

```typescript
// undefined = optional/missing
interface Options {
  timeout?: number  // May not be provided
}

// null = explicitly empty
interface User {
  deletedAt: Date | null  // Explicitly set to "no value"
}
```

---

## 4. Function Design

### 4.1 Pure Functions First

Prefer pure functions. Side effects should be isolated and explicit.

```typescript
// PURE - Preferred
function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0)
}

// IMPURE - Isolate side effects
function saveToStorage(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value))
}
```

### 4.2 Function Length

Functions should do one thing. If a function exceeds 30 lines, consider extraction.

### 4.3 Parameter Count

Maximum 3 positional parameters. Beyond that, use an options object:

```typescript
// BAD - Too many parameters
function createUser(name: string, email: string, age: number, role: string, active: boolean)

// GOOD - Options object
function createUser(options: CreateUserOptions)

// GOOD - Required params + options
function createUser(name: string, email: string, options?: UserOptions)
```

### 4.4 Default Parameters

Use default parameters, not conditional assignment:

```typescript
// BAD
function greet(name: string) {
  const displayName = name || 'Guest'
}

// GOOD
function greet(name = 'Guest') { }
```

### 4.5 Early Returns

Prefer early returns over nested conditionals:

```typescript
// BAD
function process(value: string | null) {
  if (value !== null) {
    if (value.length > 0) {
      return transform(value)
    }
  }
  return null
}

// GOOD
function process(value: string | null) {
  if (value === null) return null
  if (value.length === 0) return null
  return transform(value)
}
```

### 4.6 Factory Functions

For creating instances, use factory functions over classes when:
- No inheritance is needed
- You want to hide implementation details
- The object is mostly data + methods

```typescript
// Factory function pattern
export function createStore(options: StoreOptions): Store {
  // Private state via closure
  const state = new Map<string, unknown>()

  return {
    get(key) { return state.get(key) },
    set(key, value) { state.set(key, value) },
  }
}
```

---

## 5. Error Handling

### 5.1 Custom Error Classes

Each library defines custom error classes in `errors.ts`:

```typescript
// src/errors.ts
export class LibraryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LibraryError'
  }
}

export class ParseError extends LibraryError {
  constructor(
    message: string,
    public readonly position?: number,
    public readonly input?: string
  ) {
    super(message)
    this.name = 'ParseError'
  }
}

export class ValidationError extends LibraryError {
  constructor(
    message: string,
    public readonly field?: string
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}
```

### 5.2 Error Messages

Error messages should be:
- Actionable: Tell the user what to do
- Specific: Include relevant values
- Consistent: Use the same format throughout

```typescript
// BAD
throw new Error('Invalid input')

// GOOD
throw new ValidationError(
  `Key cannot contain comparison operators. Received: "${key}"`,
  'key'
)
```

### 5.3 When to Throw

- **Throw** on programmer errors (wrong types, invalid API usage)
- **Return** error states for expected failures (missing data, network issues)

```typescript
// Throw for invalid usage
function setFlag(key: string, value: boolean) {
  if (typeof key !== 'string') {
    throw new TypeError('Key must be a string')
  }
}

// Return for expected failures
async function fetchUser(id: string): Promise<User | null> {
  const response = await fetch(`/users/${id}`)
  if (response.status === 404) return null
  return response.json()
}
```

### 5.4 Never Swallow Errors Silently

If catching errors, either handle them meaningfully or re-throw:

```typescript
// BAD - Silent swallow
try {
  riskyOperation()
} catch (e) {
  // nothing
}

// GOOD - Log and continue
try {
  callback()
} catch (e) {
  console.error('Callback failed:', e)
}

// GOOD - Transform and re-throw
try {
  JSON.parse(input)
} catch (e) {
  throw new ParseError(`Invalid JSON: ${e.message}`)
}
```

---

## 6. Testing Standards

### 6.1 Implementing TESTS.md Specifications

Each library has a `TESTS.md` file that specifies what to test. Workers implement these specifications as actual Vitest code. The TESTS.md format maps to code as follows:

**TESTS.md format:**
```markdown
### `store.get(key)`

✓ returns value for existing key
✓ returns undefined for missing key
✓ throws TypeError if key is not a string
```

**Corresponding test code:**
```typescript
describe('store.get(key)', () => {
  it('returns value for existing key', () => {
    const store = createStore({ initial: { name: 'Alice' } })
    expect(store.get('name')).toBe('Alice')
  })

  it('returns undefined for missing key', () => {
    const store = createStore()
    expect(store.get('missing')).toBeUndefined()
  })

  it('throws TypeError if key is not a string', () => {
    const store = createStore()
    // @ts-expect-error - Testing runtime validation
    expect(() => store.get(123)).toThrow(TypeError)
  })
})
```

**Key rules:**
- Each `###` heading becomes a `describe()` block
- Each `✓` line becomes an `it()` test
- Test names must match the specification exactly (copy-paste the text after `✓`)
- Nested `####` headings become nested `describe()` blocks
- Workers write the test implementation; TESTS.md defines what to test

### 6.2 Test File Organization

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createStore } from './store'

describe('createStore', () => {
  // Group by method or behavior
  describe('get/set', () => {
    it('stores and retrieves values', () => {
      const store = createStore()
      store.set('key', 'value')
      expect(store.get('key')).toBe('value')
    })

    it('returns undefined for missing keys', () => {
      const store = createStore()
      expect(store.get('missing')).toBeUndefined()
    })
  })

  describe('validation', () => {
    it('throws ValidationError for empty key', () => {
      const store = createStore()
      expect(() => store.set('', 'value')).toThrow(ValidationError)
    })
  })
})
```

### 6.3 Test Naming

Test names should form readable sentences:

```typescript
// Pattern: "it [does something] [under what conditions]"

// GOOD
it('returns false when flag does not exist')
it('throws ParseError for malformed condition')
it('fires callback with previous and next value')

// BAD
it('test1')
it('works')
it('should handle the case where...')  // Too verbose
```

### 6.4 Arrange-Act-Assert

Every test follows AAA pattern, with blank lines separating sections:

```typescript
it('increments counter by specified amount', () => {
  // Arrange
  const store = createStore()
  store.set('count', 10)

  // Act
  store.increment('count', 5)

  // Assert
  expect(store.get('count')).toBe(15)
})
```

For simple tests, this can be condensed:

```typescript
it('returns true for existing keys', () => {
  const store = createStore({ initial: { key: 'value' } })
  expect(store.has('key')).toBe(true)
})
```

### 6.5 Test Isolation

Each test must be independent. Use `beforeEach` for shared setup:

```typescript
describe('Store', () => {
  let store: Store

  beforeEach(() => {
    store = createStore()
  })

  it('test 1', () => { /* uses fresh store */ })
  it('test 2', () => { /* uses fresh store */ })
})
```

### 6.6 Mocking

Use Vitest's built-in mocking. Mock at the boundary, not deep internals:

```typescript
import { vi } from 'vitest'

// Mock timers
beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

// Mock functions
const callback = vi.fn()
store.subscribe(callback)
store.set('key', 'value')
expect(callback).toHaveBeenCalledWith({ key: 'key', value: 'value' })

// Mock modules
vi.mock('./storage', () => ({
  save: vi.fn(),
  load: vi.fn(() => ({})),
}))
```

### 6.7 Async Testing

```typescript
// Async/await - Preferred
it('loads data asynchronously', async () => {
  const result = await fetchData()
  expect(result).toBeDefined()
})

// Testing rejections
it('throws on network error', async () => {
  await expect(fetchData()).rejects.toThrow(NetworkError)
})

// Waiting for events
it('fires callback after delay', async () => {
  const callback = vi.fn()
  scheduleCallback(callback, 1000)

  vi.advanceTimersByTime(1000)

  expect(callback).toHaveBeenCalled()
})
```

### 6.8 Edge Cases

Every test suite must include edge case tests:

```typescript
describe('edge cases', () => {
  it('handles empty string input', () => { })
  it('handles null values', () => { })
  it('handles maximum values', () => { })
  it('handles concurrent operations', () => { })
  it('handles unicode characters', () => { })
})
```

### 6.9 Test Categories

Organize tests by category using describe blocks:

```typescript
describe('FeatureName', () => {
  describe('basic operations', () => { })
  describe('error handling', () => { })
  describe('edge cases', () => { })
  describe('integration', () => { })  // If testing multiple units together
})
```

---

## 7. Documentation

### 7.1 JSDoc Comments

Public API functions and types require JSDoc:

```typescript
/**
 * Creates a new flag store instance.
 *
 * @param options - Configuration options
 * @returns A new Store instance
 *
 * @example
 * ```typescript
 * const store = createStore({
 *   initial: { darkMode: false },
 *   persist: { storage: localStorage }
 * })
 * ```
 *
 * @throws {ValidationError} If options are invalid
 */
export function createStore(options?: StoreOptions): Store {
  // ...
}
```

### 7.2 When to Comment

Comment **why**, not **what**:

```typescript
// BAD - Describes what the code does
// Loop through items and add to total
for (const item of items) {
  total += item.price
}

// GOOD - Explains why
// Using reduce would create intermediate arrays; loop is faster for large datasets
for (const item of items) {
  total += item.price
}
```

### 7.3 No Commented-Out Code

Delete unused code. Git has history.

```typescript
// BAD
// function oldImplementation() {
//   ...
// }

function newImplementation() { }

// GOOD
function newImplementation() { }
```

### 7.4 TODO Comments

TODOs must have context and ideally a tracking reference:

```typescript
// BAD
// TODO: fix this

// GOOD
// TODO(#123): Add retry logic for transient network failures
```

### 7.5 README Structure

Every library README follows this structure:

```markdown
# @motioneffector/package-name

Brief one-line description.

## Installation

## Quick Start

## API Reference

### `functionName()`

### `TypeName`

## Examples

## License
```

---

## 8. Formatting

### 8.1 Prettier Configuration

All projects use Prettier with this configuration:

```json
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "es5",
  "tabWidth": 2,
  "printWidth": 100,
  "arrowParens": "avoid"
}
```

### 8.2 ESLint Configuration

Extend from recommended configs:

```javascript
// eslint.config.js
import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': ['error', {
        allowExpressions: true,
        allowTypedFunctionExpressions: true,
      }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
    },
  }
)
```

### 8.3 Line Length

- **100 characters** soft limit
- **120 characters** hard limit
- Prefer readability over strict limits

### 8.4 Blank Lines

Use blank lines to separate logical sections:

```typescript
import { something } from 'somewhere'

const CONSTANT = 'value'

export function publicFunction() {
  // Setup
  const state = initialize()

  // Main logic
  const result = process(state)

  // Cleanup
  cleanup(state)

  return result
}
```

### 8.5 Object Formatting

```typescript
// Single line for 1-3 simple properties
const options = { timeout: 1000, retries: 3 }

// Multi-line for complex or 4+ properties
const config = {
  timeout: 1000,
  retries: 3,
  backoff: 'exponential',
  onError: handleError,
}
```

---

## 9. Imports & Exports

### 9.1 Import Order

Imports are grouped and ordered:

```typescript
// 1. Node built-ins (if applicable)
import { readFile } from 'node:fs/promises'

// 2. External packages
import { describe, it, expect } from 'vitest'

// 3. Internal absolute imports
import { ValidationError } from '@/errors'

// 4. Relative imports (parent directories first)
import { helper } from '../utils/helper'
import { local } from './local'

// 5. Type-only imports (at the end of their group)
import type { Config } from './types'
```

### 9.2 Named Exports

Prefer named exports over default exports:

```typescript
// GOOD - Named export
export function createStore() { }
export class ValidationError extends Error { }

// AVOID - Default export
export default function createStore() { }
```

### 9.3 Re-exports

The public API is defined in `src/index.ts` via re-exports:

```typescript
// Explicit re-exports
export { createStore } from './core/store'
export { ValidationError, ParseError } from './errors'

// Type re-exports
export type { Store, StoreOptions } from './types'

// AVOID barrel files in subdirectories
// Each file imports directly from source, not through index files
```

### 9.4 Circular Dependencies

Circular dependencies are forbidden. If types cause cycles, use a separate `types.ts`:

```typescript
// types.ts - Shared types
export interface Store { }
export interface StoreOptions { }

// store.ts - Imports types
import type { Store, StoreOptions } from './types'
```

---

## 10. Git Conventions

### 10.1 Commit Message Format

```
type(scope): short description

Longer description if needed. Explain what and why,
not how (the code shows how).

Refs: #123
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation only
- `style` - Formatting, no code change
- `refactor` - Code change that neither fixes nor adds
- `perf` - Performance improvement
- `test` - Adding or fixing tests
- `chore` - Build process, dependencies, etc.

**Examples:**
```
feat(store): add batch() method for atomic updates

fix(parser): handle escaped quotes in string literals

test(check): add edge cases for empty conditions
```

### 10.2 Branch Naming

```
feature/short-description
fix/issue-number-description
refactor/what-is-changing
```

### 10.3 Atomic Commits

Each commit should be a complete, working change. Don't commit half-finished work.

### 10.4 No Generated Files

`.gitignore` must exclude:
```
node_modules/
dist/
coverage/
*.log
.DS_Store
```

---

## Appendix: Checklist

Before submitting code, verify:

### Code Quality
- [ ] No `any` types
- [ ] All public functions have JSDoc
- [ ] All public functions have explicit return types
- [ ] No commented-out code
- [ ] No `console.log` (except in error handlers)
- [ ] No magic numbers/strings (use named constants)

### Testing
- [ ] All tests from TESTS.md implemented
- [ ] All tests pass
- [ ] Test names match TESTS.md specification
- [ ] Async operations properly awaited

### Documentation
- [ ] README updated for new features
- [ ] CHANGELOG updated
- [ ] JSDoc examples are correct

### Formatting
- [ ] Prettier has been run
- [ ] ESLint shows no errors
- [ ] Import order is correct
