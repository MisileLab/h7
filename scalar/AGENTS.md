# AGENTS.md (scalar)

## Commands
- Install: `npm install` (repo README), or `pnpm install` (pnpm-lock present)
- Dev: `npm run dev` (Vite)
- Build: `npm run build`
- Preview prod build: `npm run preview`
- Typecheck (no emit): `npx tsc -p tsconfig.json`
- Tests (all): `npm run test` (Vitest)
- Tests (watch): `npm run test:watch`
- Single test file: `npm run test -- src/sim/rules/power.test.ts`
- Single test by name: `npx vitest run -t "applyMaintenance"`
- Sim tools: `npm run sim:run -- --seed 123 --turns 10 --out replay.json`, `npm run sim:validate -- replay.json`

## Code style / conventions
- TypeScript is **strict** (see `tsconfig.json`); don’t add `any` or suppress type errors.
- Prefer small, deterministic changes (simulation must stay deterministic; don’t use `Math.random()`/`Date.now()` in sim—use existing RNG utilities).
- Formatting is 2-space indent; keep the file’s existing quote/import style (codebase is mixed).
- Imports: keep grouped and readable (external vs relative); avoid unused imports.
- Naming: camelCase (vars/functions), PascalCase (types/classes), UPPER_SNAKE_CASE (constants).
- Error handling: throw `new Error(...)` for impossible states; for gameplay/sim failures, prefer emitting `SimEvent`s (existing pattern).

## Repo rules
- No Cursor rules (.cursor/rules or .cursorrules) and no Copilot instructions found in this repo.
