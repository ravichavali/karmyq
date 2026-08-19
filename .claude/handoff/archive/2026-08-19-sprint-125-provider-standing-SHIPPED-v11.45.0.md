# Sprint 125 — Provider Standing & Community Reach — SHIPPED v11.45.0

> **ARCHIVED 2026-08-19.** Merged as PR #209, squash `f1197a17`, deployed and smoke-tested on
> demo. History only — see `CURRENT_HANDOFF.md` for live state.

> ## State as of 2026-08-19
>
> Branch `feature/sprint-125-provider-standing`, cut from `a1cf9eca` (v11.44.0). Version bumped to
> **v11.45.0**. Committed as `b92ab5c2`, pushed, and open as **PR #209**. The local pre-push hook
> ran and passed. **All CI checks are green**, including functional, build, type, audit, contract,
> integration, Docker images, CodeQL, and the ADR-060 gate. CodeQL alert **#577**
> (`js/request-forgery`, `apps/frontend/src/lib/api.ts:951`) was dismissed as the documented
> browser-side Axios false positive with maintainer authorization on 2026-08-19; the rationale is
> recorded in PR #209's Security dismissals section. The PR is not merged. Merge still requires
> explicit maintainer authorization.
>
> ⚠️ **Run the suite with `npx turbo run test --concurrency=2` on this machine.** Default
> concurrency exhausts its 8 GB and aborts with SIGABRT (exit 134) — a *different* set of suites
> fails each run and every one passes in isolation. That is memory pressure, not breakage; do not
> chase those failures.
>
> ⏰ **The `image-size` exemption crisis is RESOLVED for now** — renewed to **2026-09-15** under an
> amended ADR-059. See "The ADR-059 amendment" below; it carries an obligation.

## Sprint goal (unchanged)

Enforce the provider policy that migration `022-provider-profiles.sql` and ADR-041 already shipped
— community-gated reach, authenticated directory — and deal with the `image-size` advisories.

---

## What shipped in this branch

| Task | State |
|---|---|
| 1. `image-size` decision | **Done** — remediation ruled out on evidence; ADR-059 amended; renewed to 2026-09-15 |
| 2. Weekly upstream monitor | **Done** — workflow + arbiter script + 24 tests |
| 3. Reach index migration | **DROPPED** — review showed it unjustified (see below); `init.sql` reverted to HEAD |
| 4. Reach-gate tests (RED first) | **Done** — 13 RED → green |
| 5. Reach gate implementation | **Done** — `providerReachService.ts` + `GET /providers/community/:communityId` |
| 6. Close the public directory | **Done** — `authMiddleware` ×3, `decodeOptionalViewer` deleted |
| 7. Frontend `ProvidersTab` | **Done** — 14 tests |
| 8. Admin switch made honest | **Done** — allowlist editor + **a real bug fixed** (below) |
| 9. ADR-095 + guides + landing | **Done** — indexed, nav-wired, grep-verified |
| 10. CONTEXT.md + registry + integration test | **Done** — 17 integration tests against real Postgres |
| 11. SDLC gates | **Done** — all three run, every finding fixed (see below) |
| 12. Final verification | **Done** — suite green, type checks clean, hooks confirmed installed, landing churn reverted |
| 13. Merge + deploy | **IN PROGRESS** — commit `b92ab5c2` pushed; PR #209 open and fully green; merge needs explicit maintainer authorization |

---

## SDLC gate findings (all fixed — these are the ones worth remembering)

**`/security-review`: no HIGH/MEDIUM findings.** Verified: membership re-derived live not from the
JWT claim; 403 fires before the layer query; no status-code oracle (missing community and
non-member both 403); all params bound; explicit SELECT lists; `contents: read` means the monitor
workflow genuinely cannot write the registry.

**`/code-review` (high): 4 findings, all real.**

1. **The directory was still anonymously enumerable one hop sideways.** ADR-095 claimed the
   provider directory required auth. `GET /reputation/provider-trust/:providerId` and
   `/provider-reviews/:providerId` were still public — and the second returned **`reviewer_name`**,
   the real names of members who left reviews. Both closed. **Lesson: audit an access surface by
   DATA EXPOSED, not by service.**
2. **Monitor logic bug my own test missed.** `advisories.every(a => { if (a.withdrawn_at) return
   false; … })` — `false` is not the neutral value in `.every`. One withdrawn advisory
   short-circuited the predicate and fired a spurious `parent-moved`. The withdrawn test asserted
   only that `patched-release` didn't fire, which is why it slipped through.
3. **`provider_services_list` written unvalidated.** `"trades"` vs `"tradesperson"` would be
   accepted with a 200 and silently empty a community's provider layer. Now validated in
   `config-validator.ts` (not the route — that is where every other config rule lives).
4. **Admin saves and nothing happens.** Config was fetched once on mount and never refetched, so
   enabling provider services showed no Providers section until a full reload. `refetchConfig` is
   wired through and called after a successful save — and deliberately NOT after a failed one,
   which would overwrite unsaved edits with stale state.

**`/simplify`: 4 agents.** Biggest catch — the 7→30 cap is justified *entirely* by the monitor, and
that argument only holds for packages the monitor watches. A second exempted package would inherit
30 days with zero monitoring. Now a `WATCHED_PACKAGES` coverage contract with a regression test, so
it is a build failure rather than a paragraph.

**I reversed one of my own decisions.** The reach index migration was dropped: the query binds both
columns per row, so the existing `UNIQUE (user_id, community_id)` already serves it as an exact
seek. My migration rationale described a scan the query never performs, while the write cost on a
hot table was certain. `trust_scores` has 0 rows on demo so no plan test was possible — unable to
substantiate the benefit, I dropped it rather than ship it behind a confident comment.

---

## The ADR-059 amendment (maintainer decision, 2026-08-17)

`MAX_EXEMPTION_DAYS` raised **7 → 30**. The maintainer asked for a horizon to 2026-09-15; the
original request was for that date under the old cap, which `audit-exemptions.js` would have
**rejected** (29-day span vs a 7-day cap) and failed closed, blocking every PR. The amendment was
the chosen path.

**⚠️ THE OBLIGATION THAT CAME WITH IT.** The seven days were never the value — the value was that
renewing forced a human to re-measure upstream. That obligation moved to
`.github/workflows/image-size-advisory-watch.yml`, which re-measures weekly from live arbiters.
ADR-059 now states, and this handoff repeats: **if that workflow is ever removed or left failing,
the cap must go back to 7 in the same change.** Otherwise the registry becomes the graveyard
ADR-059 was written to prevent.

Current exemptions: both `image-size` GHSAs, created 2026-08-17, **expire 2026-09-15**.

---

## Verified findings from this sprint (read out of source, not inherited prose)

- **`patch-package` cannot remediate `image-size`.** The ADR-059 gate runs
  `npm audit --package-lock-only` (`scripts/audit-exemptions.js:274`) — it audits the **lockfile**,
  which a source patch does not change. Recorded in the exemption rationale.
- **Upstream unchanged as of 2026-08-17**: `image-size@2.0.2` latest, both GHSAs `<= 2.0.2` with
  `first_patched_version: null`, neither withdrawn, `metro@0.87.0` still `^1.0.2`, tree still
  `expo@57.0.12 → @expo/metro@56.0.0 → metro@0.84.4 → image-size@1.2.1`.
- **The plan's Task 7 was wrong about the frontend.** It said to register a new top-level tab in
  `communityTabs.ts`. ADR-068 deliberately collapsed ~10 tabs into four, and `providers` **already**
  aliases to the *admin* Stewardship section. `ProvidersTab` renders inside **Home** instead.
- **`PROVIDER_SERVICE_TYPES` already existed** in `packages/shared/src/schemas/providers/index.ts:63`.
  An initial local duplicate in `ProfileTab.tsx` was replaced with the shared import.
- **No local Docker on this machine.** All Postgres work ran on the demo server in **disposable**
  containers; `karmyq-postgres` was never touched and all demo containers were left as found.

---

## Bug found and fixed (not in the plan)

**`ProfileTab` never synced `providerConfig` from the server config.** It initialised to
`{enabled: false, floor: 0, list: []}` and stayed there, so the provider form always rendered "off"
and pressing **Save wrote those defaults back**. Harmless while nothing read the three columns —
**destructive now that the reach gate enforces them** (open the tab, save, and a community's
provider layer switches off). Fixed with a sync effect (`??`, not `||`, so a floor of 0 survives);
4 regression tests including the destructive open-then-save path. Mutation-tested: neutralising the
sync fails 12 of 14.

---

## What proves the gate actually works

Mocked-DB tests **cannot** prove a SQL gate rejects — the conditions live in SQL, so a stubbed test
asserts its own mock. The layers, and what each earns:

| Layer | Proves |
|---|---|
| `tests/tdd/sprint-125-provider-reach-gate.test.ts` | auth + live-membership gates, empty-layer-not-404, route ordering, SQL still carries each condition |
| `tests/unit/providerReachService.test.ts` | the query's exact shape (LEFT JOIN, COALESCE, cardinality-means-all) |
| `tests/integration/sprint-125-provider-reach-gate.integration.test.ts` | **the gate rejects** — both directions, per condition, against real Postgres |

**Mutation-verified against the live database** (all caught):
`LEFT JOIN`→`INNER JOIN` = 5 failures · empty-allowlist-as-deny-all = 6 · dropping the enabled flag = 1.

---

## Running the integration tests (no local Docker)

```bash
# On demo: disposable container, NEVER karmyq-postgres
ssh ubuntu@karmyq.com 'docker run -d --name karmyq-init-verify \
  -e POSTGRES_USER=karmyq_verify -e POSTGRES_PASSWORD=verify_password -e POSTGRES_DB=karmyq_verify \
  -p 127.0.0.1:55432:5432 -v /path/to/init.sql:/docker-entrypoint-initdb.d/init.sql:ro postgres:15-alpine'
ssh -f -N -L 55432:127.0.0.1:55432 ubuntu@karmyq.com
cd services/request-service && DATABASE_URL='postgres://karmyq_verify:verify_password@127.0.0.1:55432/karmyq_verify' \
  npx jest tests/integration/sprint-125-provider-reach-gate.integration.test.ts
```

`init.sql` regeneration uses the same pattern (`REGEN_PG_CONTAINER`). **Tear down the container and
tunnel afterwards.**

---

## Next steps

1. **Merge needs explicit maintainer authorization**; `--admin` needs its own each time.
2. Deploy via `/deploy`, smoke-test `POST /api/auth/login` then the new endpoint against a
   community with provider services enabled *and* one with it disabled.

---

## Known rough edges (NOT fixed here, deliberately)

- **`init.sql` regeneration is pg_dump-version-sensitive.** Regenerating on PostgreSQL 15.15
  reformatted 12 `CHECK` constraints (`ANY ((ARRAY[…])::text[])` → `ANY (ARRAY[(…)::text, …])`).
  `normalize_schema_dump` canonicalizes this for exactly two constraints and not the other twelve.
  Cosmetic and cannot break CI (both sides of every drift comparison use the same pg_dump), but the
  normalizer gap is real. Not logged as a bug yet — maintainer's call.
- **`trust_scores.score` has `DEFAULT 50`** while a *missing* row is treated as 0. Two members with
  no activity score differently depending only on whether some earlier codepath inserted a row.
  ADR-095 fails closed at 0 deliberately and records this as deferred.
- **BUG-036 still open**: `.github/workflows/test.yml` uses a fixed `sleep 30` before the Docker
  health probe, racing cold image pulls. Separately scoped.

---

## Arc

- Sprint 123 — licensing and truth audit: complete, v11.43.0.
- Sprint 124 — exemption mechanism and honest Expo drift gate: complete, v11.44.0.
- **Sprint 125 — provider standing + `image-size`: implemented, gates in progress, not merged.**
- Sprint 126 — honest demo-data backfill through production math.
- Sprint 127 — live simulation across all users.

---

## Standing mechanics

- Branch from `origin/master`; never direct-push to master and never force-push.
- Every merge needs explicit maintainer authorization; `--admin` override needs its own each time.
- Do not use a docs-only master push to reconcile this handoff; land it with Sprint 125 work.
- Dependency edits are surgical: no workspace install, dedupe, or lockfile scratch regeneration.
  (`semver` was added to root `devDependencies` this sprint for the monitor script — one line in
  `package.json`, one spliced into `package-lock.json`, proven with strict `npm ci`.)
- `curl`/`jq` unreliable/unavailable on Windows; use `node -e`. `| tail` masks exit codes — it hid
  a real `npm test` failure this sprint; always capture the exit code separately.
- Landing docs regenerate on `npm test`; revert `build.json`/`architecture.json` timestamp and
  HEAD-sha churn before committing.
