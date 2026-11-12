# Apps Directory

Three workspaces. **Each has its own detail file — read that one for the app you're touching:**

| App | Port | Stack | Local context |
|---|---|---|---|
| `frontend/` | 3000 | Next.js 16, Pages Router, Tailwind v4 | [frontend/claude.md](frontend/claude.md) |
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

Sprint 128 PR B raises the Next.js minimum to 15.5.24 alongside the frontend security patch.
The landing site retains `output: 'export'` and unoptimized images (`landing/next.config.js`);
verify its static production build with the patched runtime. ADR-059 records the shared
Sharp, XML and YAML dependency remediation.

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

⚠️ **`src/data/docs/` is GENERATED — `nav.json` included.** The landing prebuild regenerates it
and any hand edit is lost; a regeneration can also drop an entry you added by hand. Fix the
source lists in `scripts/generate-docs.ts` instead.

**Authoring docs** — author the SOURCE, never `src/data/docs/`:
- **Concept / User Guide** — write `docs/concepts/<slug>.md` or `docs/guides/<slug>.md`, then add
  the slug to the ordering arrays in `scripts/generate-docs.ts` (`CONCEPT_ORDER` **and** one of
  `whyKarmyq` / `howItWorks`), then regenerate. Missing either list fails the drift gate.
- **ADR** — write `docs/adr/ADR-{NNN}-{slug}.md`, index it in `docs/adr/README.md`, **and add the
  slug to a group in `ADR_GROUPS`** in `scripts/generate-docs.ts`, then regenerate. The generator
  does *not* fall back to listing an ungrouped ADR: it emits the page with **no nav entry**, and the
  drift gate fails. ⚠️ `apps/landing/src/data/docs/` is gitignored but ~122 of its files are
  tracked, so a newly generated page is invisible to `git status` and needs `git add -f`.

The landing site calls the API **cross-origin**, so it needs an absolute `karmyq.com/api` base and
the origin present in the backend's `ALLOWED_ORIGINS` — a relative path works locally and breaks in
production.
