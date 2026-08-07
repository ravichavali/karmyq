# Apps Directory

Three workspaces. **Each has its own detail file — read that one for the app you're touching:**

| App | Port | Stack | Local context |
|---|---|---|---|
| `frontend/` | 3000 | Next.js 15, Pages Router, Tailwind v4 | [frontend/claude.md](frontend/claude.md) |
| `landing/` | 3100 | Next.js, App Router — public site + docs | this file, below |
| `mobile/` | — | React Native + Expo SDK 57 | [mobile/claude.md](mobile/claude.md) |

This file covers only what's shared or otherwise homeless.

---

## Shared patterns across the apps

- **Per-service API clients, not one instance.** Both `frontend` and `mobile` build one axios
  client per backend service via a `createClient(baseURL)` factory, because each service has its
  own origin/port. Reach for the existing service module before adding a client.
- **JWT payload field is `communities`**, never `communityMemberships`. The wrong name is always
  `undefined`, which reads as "no membership" and 403s. Claims are login-time snapshots and role
  *hints* only — the server re-derives membership on every authorization decision.
- **Test tiers** are the same everywhere: `tests/{unit,regression}` block, `tests/tdd` is WIP and
  auto-promotes, `tests/integration` needs a DB. New work starts in `tests/tdd/`.
- Shared types come from `@karmyq/shared` — declare it in the app's own `package.json`; hoisting
  is not a contract.

## `landing/` — the public site and docs portal

```
src/app/         App Router pages
src/components/
src/data/docs/   nav.json + api/architecture/build/concepts/services JSON + concepts/ guides/ services/
src/lib/
```

```bash
cd apps/landing
npm run dev            # http://localhost:3100
npm run generate-docs  # npx tsx ../../scripts/generate-docs.ts
npm run build          # prebuild runs generate-docs first
```

⚠️ **`prebuild` regenerates `src/data/docs/`, so running the full test/build suite leaves that
directory dirty** with timestamp and HEAD-sha churn. Revert the noise before committing, or it
lands in an unrelated diff.

⚠️ **`nav.json` silently reverts.** Regeneration can drop a hand-added entry. After editing it,
grep the file to confirm your entry survived — don't assume the write stuck.

**Authoring docs** (every page must be wired into `nav.json`, and the doc/context drift gate
enforces it):

- ADR → `concepts/adr-{NNN}-{slug}.json`: `{ slug, number, title, status, description, content, filename }`
- Concept / user guide → `{ slug, title, description, content }`
- Service endpoint entry → `{ method, path, description }`

The landing site calls the API **cross-origin**, so it needs an absolute `karmyq.com/api` base and
the origin present in the backend's `ALLOWED_ORIGINS` — a relative path works locally and breaks in
production.
