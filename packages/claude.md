# Packages Directory

One workspace: **`packages/shared`** (`@karmyq/shared`), consumed by 9 services + the frontend.

Technical detail lives in [`shared/CONTEXT.md`](shared/CONTEXT.md) — **update it in the same PR as
any export change** (the docs feedback loop checks this).

---

## ⚠️ The dual-root layout — read this first

`packages/shared/tsconfig.json` sets `"rootDir": "."` with `"include": ["**/*"]`, so `dist/`
mirrors *both* source roots:

| Source | Compiles to | Subpath example |
|---|---|---|
| `middleware/`, `types/`, `utils/`, `constants/`, `events/` (package root) | `dist/middleware/…` | `@karmyq/shared/middleware/auth` |
| `src/matching/`, `src/schemas/`, `src/trust/`, `src/projections/` | `dist/src/matching/…` ⚠️ note the extra `src` | `@karmyq/shared/matching` |

Newer modules landed under `src/`, older ones sit at the package root, and **neither moved**. That
is why `package.json` `exports` contains both `./dist/middleware/auth.js` and
`./dist/src/matching/index.js`. When adding a module, match the neighbours you're sitting next to
and let the export path absorb the difference — don't relocate existing files to tidy this up.

## ⚠️ Every subpath must be declared three times

A new subpath import needs **all three** or it breaks somewhere:

1. `exports["./your/path"]` → `{ types: "./dist/…d.ts", default: "./dist/…js" }` — runtime resolution.
2. `typesVersions["*"]["your/path"]` → **the `.ts` SOURCE path**, not `dist`. `ts-jest` forces
   `node10` module resolution, which ignores `exports` entirely and consults `typesVersions`;
   pointing it at `dist` breaks type resolution in tests.
3. Consumers need `"moduleResolution": "node16"` (or `nodenext`) to see `exports` at all.

Root `tests/jest.config.js` additionally maps `@karmyq/shared` to TypeScript **source** via
`moduleNameMapper`, so tests run without building `dist/` first. If a new subpath fails to resolve
in a test, add it to that map — don't build `dist/` to paper over it.

**Every workspace that imports `@karmyq/shared` must declare it** in its own `package.json`
(all 10 currently do, at `*`). Hoisting is npm's optimization, not a contract.

---

## What's actually exported

```typescript
// Barrel — types, constants/config, all middleware, logger, response, createPublisher,
// classifyDecayTier, reputationDisclosure, relationshipContext, completedExchange
import { ApiResponse, createPublisher } from '@karmyq/shared'

// Subpaths (the full list is package.json "exports")
import { authMiddleware } from '@karmyq/shared/middleware/auth'
import { createRateLimiter } from '@karmyq/shared/middleware/rateLimit'
import { createLogger } from '@karmyq/shared/utils/logger'
import { classifyDecayTier } from '@karmyq/shared/trust/decayTier'
```

**There is no `@karmyq/shared/utils` barrel** — only `./utils/logger` and `./utils/response`.
Likewise no `./api` subpath: `api/` (`client.ts`, `mobile-storage.ts`, `web-storage.ts`) is not in
the exports map, not re-exported by `index.ts`, and has no importers. Treat it as dormant.

### `middleware/` — the real names

| Module | Exports |
|---|---|
| `auth.ts` | `authMiddleware`, `optionalAuthMiddleware`, `verifyTokenWithRotation`, `isDemoReadOnlySession`, types `JWTPayload` / `AuthenticatedRequest` |
| `tenant.ts` | `tenantMiddleware`, `optionalTenantMiddleware`, `adminOnlyMiddleware` |
| `dbContext.ts` | `dbContextMiddleware`, `setDbContext`, `clearDbContext`, `getCurrentUserId`, `getCurrentCommunityId` |
| `rateLimit.ts` | `createRateLimiter`, `rateLimiters`, `globalRateLimiter`, `RateLimitPresets` |
| `validate.ts` | `validate`, `validateMultiple`, `commonValidators`, `paginationSchema`, `communityParamsSchema`, `userParamsSchema` |
| `bodyDefaults.ts` | `normalizeRequestBody` |

**The JWT payload field is `communities`, not `communityMemberships`.** And a JWT claim is a
login-time snapshot — anything gating visibility or writes must re-derive membership from a live
lookup, not from the claim.

---

## Commands

```bash
cd packages/shared
npm run build        # tsc -> dist/ (mirrors both roots; services need this before their own build)
npm run type-check   # tsc --noEmit
npm test             # jest — specs in src/**/__tests__/
```

Turbo builds `@karmyq/shared` first for any workspace that declares it. A stale `dist/` is a
classic false-green: it can hide a real break locally that CI then catches.

## Adding shared code

1. Create the module (root-level or `src/`, matching its neighbours).
2. Re-export from `index.ts` if it belongs in the barrel.
3. Add `exports` **and** `typesVersions` entries for any new subpath (see above).
4. `npm run build`, then update [`shared/CONTEXT.md`](shared/CONTEXT.md) in the same PR.
