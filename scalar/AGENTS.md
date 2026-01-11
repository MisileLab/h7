# Agent Guide for scalar

## Project snapshot
- TypeScript + Vite + Phaser project
- Package manager: Yarn 4 (see `packageManager` in `package.json`)
- Tests: Vitest
- No ESLint/Prettier configs present

## Commands
### Install
- `yarn install`

### Dev
- `yarn dev`

### Build
- `yarn build`
- Vite config: `vite.config.ts`

### Preview
- `yarn preview`

### Tests (Vitest)
- Watch mode: `yarn test`
- Run once: `yarn test:run`
- Single test file: `yarn test:run tests/sim.test.ts`
- Filter by test name: `yarn test:run -t "RNG is deterministic"`

### Lint/format
- No lint or format scripts configured
- No ESLint/Prettier configs found

## Code style conventions (observed)
### Formatting
- Indentation: 2 spaces (`.editorconfig`)
- Line endings: LF
- Final newline required
- Semicolons used
- Single quotes for strings
- Trailing commas in multi-line objects/arrays
- Blank line after imports

### Imports
- ES module imports
- Relative paths for local modules
- Type-only imports for types (`import type { ... }`)
- Group imports by module origin (external then local)

### Naming
- `camelCase` for variables, functions, properties
- `PascalCase` for classes, interfaces, types, enums
- File names:
  - `PascalCase.ts` for classes/scenes (e.g., `GameScene.ts`)
  - `camelCase.ts` for utilities/modules (e.g., `state.ts`)

### Types & strictness
- TypeScript `strict: true` (`tsconfig.json`)
- Avoid `any` and unchecked casts
- Prefer union types and explicit interfaces
- Use `Record<...>` for keyed maps
- Keep types close to usage (co-locate with module)

### Error handling
- Use explicit checks with early returns where possible
- Throw for unrecoverable failures (e.g., missing DOM elements)
- When reading `localStorage`, guard with type checks and fallbacks
- Avoid empty `catch` blocks

### State updates
- Prefer immutable updates with spreads
- Clamp numeric values with helpers to enforce bounds

## Testing conventions
- Tests live in `tests/`
- Use `describe`/`it` with `expect` from Vitest
- Prefer deterministic RNG when testing randomness
- Keep tests focused on single behavior

## Project structure
- `src/` contains core game logic, scenes, UI helpers
- `tests/` contains unit tests
- `vite.config.ts` for build settings

## Key files
- `package.json`: scripts and dependencies
- `tsconfig.json`: TypeScript settings
- `.editorconfig`: formatting rules
- `vite.config.ts`: Vite configuration

## Agent guardrails
- Match existing style: 2-space indent, semicolons, single quotes
- Keep changes minimal and focused
- Do not add new tooling unless requested
- Do not commit unless asked

## Cursor/Copilot rules
- No `.cursorrules` found
- No `.cursor/rules/` directory found
- No `.github/copilot-instructions.md` found

## Notes for single-test runs
- File path: `yarn test:run tests/sim.test.ts`
- Test name filter: `yarn test:run -t "name"`
- For quick feedback, prefer single-file runs before full suite

## Typical workflow
1. `yarn install`
2. `yarn dev`
3. Edit TypeScript in `src/`
4. `yarn test:run tests/sim.test.ts`
5. `yarn build`

## Example patterns
### Type-only import
```ts
import type { GameState } from '../core/state'
```

### Immutable update
```ts
const next: GameState = {
  ...state,
  inventory: {
    ...state.inventory,
    supplies: Math.max(0, state.inventory.supplies + delta),
  },
}
```

### Guarded localStorage
```ts
const raw = localStorage.getItem(key)
if (!raw) return undefined
const parsed = JSON.parse(raw) as unknown
if (!parsed || typeof parsed !== 'object') return undefined
```

## When adding new code
- Keep functions small and single-purpose
- Prefer pure helpers in `src/core/`
- Use Phaser scene methods for rendering logic
- Add tests for core logic changes when feasible

## Notable configs
- `tsconfig.json` uses `moduleResolution: "bundler"`
- `types` includes `vitest/globals`

## Performance considerations
- Avoid heavy per-frame allocations in `update`
- Cache lookup tables when used repeatedly

## Explicit non-goals
- No CSS or UI framework in this repo
- No server-side code
- No database or network access in core logic
