# Current Handoff — as of 2026-09-05 (Sprint 127 implemented, unmerged)

**Version:** v11.46.0 · **Branch of record:** `master` at **`ea7ee194`** (PR #219, merged
2026-09-05) · **Demo:** deployed and **smoke-tested healthy** — `GET karmyq.com/` 200,
`POST /api/auth/login` 401 with the ADR-074 envelope, `karmyq.org/docs/...` 200

---

## 🔀 Active lanes

Parallel development runs from two checkouts on two machines (Windows primary, Mac second). When
lanes are active, find your branch below and read/update **only that lane's file**.

| Lane | Machine | Branch | Handoff file | Sprint |
|---|---|---|---|---|
| Knowledge registry | Windows (primary) | `feature/sprint-127-knowledge-registry` | this file | 127 |

Only one lane is active, so this file *is* the lane state — no separate `lane-<slug>.md` is needed
until a second machine picks up a concurrent sprint.

⚠️ **This table is a pointer, not a coordination store.** It is a branch-local file, so it can be
stale and it is **never** the authority on who owns a contended resource. Derive those from their
live arbiters — see `CLAUDE.md` → *Parallel Development* → **Why reservations do not work here**
(ADR numbers, version bump, dependency lane, merge slot, demo data ops).

---

## Quick Start — read this, then pick from Outstanding below

1. `git fetch origin` and confirm real state before trusting anything written here:
   `gh pr list` and `git log --oneline origin/master -3`.
2. **PR #219 is MERGED** (squash `ea7ee194`), deployed, and smoke-tested.
3. **Sprint 127 is IMPLEMENTED and unmerged** on `feature/sprint-127-knowledge-registry`
   (13 implementation commits on top of the spec branch, so the spec, plan and implementation
   ship as one PR). All 13 plan tasks are complete; `npx turbo run test` is **26/26 green**.
4. **What remains before merge:** the `/code-review` and `/security-review` gates, the version
   bump, opening the PR, and merge authorization. See *Sprint 127 — state* below.
5. ADR number **097** was maintainer-allocated and is in use.

---

## What shipped

**Sprint 126 — Honest Standing Backfill.** PR **#210 merged** 2026-09-03, squash `9083a79a`,
version **v11.46.0**, deployed and smoke-tested. The demo backfill was **applied and converged**
as an explicitly authorized data operation: 20,341 karma rows, 6,800 activity rows, 5,683 trust
pairs, 8,403 of 8,403 completed matches projected, idempotency proven against live data. Backup at
`~/backups/pre-s126-backfill-20260903T203953Z.dump`.

Full record: [`archive/2026-09-03-sprint-126-standing-backfill-SHIPPED-v11.46.0.md`](archive/2026-09-03-sprint-126-standing-backfill-SHIPPED-v11.46.0.md)
(historical — do not follow its instructions).

---

## Open right now

### PR #219 — MERGED 2026-09-05, squash `ea7ee194`
Shipped the `Parallel Development` rules in `CLAUDE.md`, the `AGENTS.md` topology rewrite, the
handoff lane convention, BUG-038, and a **real ADR-number uniqueness assertion** in the drift gate
(5 → 7 tests) replacing a backstop the earlier text claimed but had never implemented.

Merged with `--admin` under explicit maintainer authorization: the required approving review could
not be self-provided (the PR was authored by the same account), and all 20 checks passed.

**Codex reviewed three rounds** (`9b726c16`, `ccbc1bbf`, `ad6b38f3`). Round 1: reservations not
reliably shared between branches; self-contradictory handoff. Round 2: ADR allocation still raced
and the claimed backstop did not exist; an open Dependabot PR permanently occupied the dependency
lane. Round 3: superseded rules left in the summary table. All fixed before merge.

The durable correction: **querying live state establishes what is visible; allocating ownership
still requires serialization.** ADR numbers, the dependency lane and demo operations are now
maintainer-allocated, and ADR uniqueness is enforced by a real gate
(`tests/regression/doc-context-drift-gate.test.ts`, 5 → 7 tests, with a negative fixture proving it
fails on two `ADR-097` files).

### Sprint 127 — state: IMPLEMENTED, not yet merged

Branch `feature/sprint-127-knowledge-registry`, cut from the spec branch (which already carried
`master` at `ea7ee194`), so the PR ships spec + plan + implementation together.

**All 13 plan tasks complete.** `npx turbo run test --concurrency=2` → **26/26 tasks, exit 0**;
602 regression tests pass.

What shipped:

- `docs/gotchas/` with **six seed entries** — three carrying declarative machine checks
  (hooks path, landing generation, Node 24 floor), three carrying review dates (npm status page,
  ADR-059/BUG-038, Dependabot/Expo).
- `scripts/gotcha-registry.js` — dependency-free CommonJS validator; `scripts/gotcha-check.js` —
  CLI for validation (`--staged`) and discovery (`--for <paths>`).
- `tests/regression/sprint-127-gotcha-registry-gate.test.ts` — **67 tests**: 12 positive over the
  real registry, 50 negative fixtures, and a clean-room fixture that clones the candidate commit
  and runs the validator under bare `node` with no `node_modules`.
- Credential screen in `scripts/git-hooks/pre-commit`, proven with four probes in a disposable
  clone (partial-staging bypass, quoted JSON key, orphaned `.md`, and deletion-must-pass).
- Onboarding-policy assertion in the drift gate; README/CONTRIBUTING/claude.md now state
  `npm ci` + `npm run hooks:install` identically.
- `.claude/skills/learned/SKILL.md` and a capture checkpoint in the `ship` skill.
- `docs/concepts/how-karmyq-learns.md` (public), CONTRIBUTING authoring manual, and
  **ADR-097**.

**Both new gates were proven falsifiable**: breaking `hooks_dir=".git/hooks"` fails the registry
gate with "no longer contains"; regressing README to `npm install` fails the onboarding assertion.

**Two real defects were caught by the suite after the docs commit** and fixed in `f2ea4958`: a
generated ADR page reaches `nav.json` only if its slug is in `ADR_GROUPS` (ADR-097 was missing),
and the ADR's passing mention of a licence token registered as an unenumerated claim site.

**Still to do before merge:** `/code-review` (high) and `/security-review`; the version bump
(derive from `origin/master` **at merge time** — it is 11.46.0 as of 2026-09-05, so 11.47.0
unless another lane merges first); open the PR with the full template body; merge authorization.

Spec: `docs/superpowers/specs/2026-09-04-ecosystem-knowledge-registry-design.md`.
Plan: `docs/superpowers/plans/2026-09-04-sprint-127-knowledge-registry.md`.

### Design spec — how it got here

Proposes `docs/gotchas/` — a home for operational knowledge that today lives only in one
maintainer's private agent memory and reaches nobody else. Every entry carries exactly one of a
declarative machine check or an expiry date. **Review-approved: "no remaining plan blockers"
(Codex, round 4).** Two rounds on the spec and four on the plan are integrated; 25+ findings, zero
false positives. Spec round 1: renewal
rule too blunt, doc-agreement gate asserted weaker than it claimed, `js-yaml` undeclared, plus asks
on discovery, scope and credential screening. Round 2: the renewal rule needed information the
schema cannot express (promotion is now a reviewer decision, not a validator rule), and `scope`
must name git-tracked paths rather than machine-local ones.

**Format decided: JSON sidecars** (one `.json` + one `.md` per entry, orphans rejected), which
takes no new dependency — so **this lane is dependency-independent** and can run concurrently with
the ADR-059/exemptions work. Codex has **no further design objections to implementation planning**
once the remaining text reconciliation lands.

The spec was approved and **implementation is complete** — see *Sprint 127 — state* above. This
section is retained as the record of how the design was reached.

---

## Outstanding — rough priority

1. **BUG-038 — ADR-059 gate cannot distinguish "no advisories" from "no answer."** Independently
   reproduced by Codex with a synthetic error response: empty registry passes, shipped registry
   blocks with misleading removal advice. **The pattern to copy already exists in-repo** —
   `tests/regression/sprint-122-adr-060-code-scanning-gate.test.ts:361-374`, "ADR-060 gate —
   refuses to fail open on API errors". Still unfixed — Sprint 127 **documented** it as
   `docs/gotchas/adr-059-cannot-tell-no-answer-from-no-advisories.md` (review date 2027-03-04),
   which stops the misleading advice being acted on but does not repair the gate. Next sprint
   candidate.
2. **⏰ `security/audit-exemptions.json` expires 2026-09-15** (2 GHSA entries). After that every PR
   blocks on the ADR-059 gate. Same lane as (1); owns the dependency surface.
3. **PR #218 — Dependabot production-deps group.** Do **not** merge: it bumps 6 React Native
   packages past Expo SDK 57 pins (`react-native` 0.87.1 vs 0.86.2, plus maps, safe-area-context,
   reanimated, worklets, screens), caught by
   `tests/regression/sprint-122-expo-sdk-alignment.test.ts:175`, with 7 consequent TS errors in
   `apps/mobile`. Regenerates weekly until `.github/dependabot.yml` ignores the SDK-managed
   packages — and that ignore list must be generated from or verified against the gate's
   `SDK_PINNED` map, not hand-copied.
4. **Two operator-report preview inaccuracies** from the Sprint 126 backfill (`scoreBuckets`
   predicts 1,518 pairs at score 0 where the stored minimum is 1; `providerEligibility` predicts
   384 providers where 499 of 501 qualify). Stored data is correct; the operator preview is wrong,
   which matters because it is what an operator reads before authorizing a destructive operation.
5. **ADR-095 floor 20 is barely selective** — 499/501 providers clear it. Needs a deliberate
   decision; changing the floor requires its own authorization.
6. **Is a non-blocking linter still the policy?** `.github/workflows/ci.yml:78` runs
   `npm run lint --if-present || echo "...non-blocking"`, so lint failures never fail CI, while the
   `apps/mobile` type-check at `:75` does block. That is configured intent, not a defect — but it
   was written before the current posture that a gate which cannot fail is worse than no gate.
   Worth a deliberate yes or no rather than leaving it implicit. Surfaced 2026-09-05 when a green
   `Lint & Type Check` job carried an `npm run lint exited (1)` annotation.

---

## Second machine (Mac) — setup in progress

Steps 1–7 of the setup are unaffected by anything above. Known corrections from the first attempt:

- `git config core.hooksPath` is **empty on a fresh clone** — that is correct. The installer reads
  it and falls back to `.git/hooks` (`scripts/install-hooks.sh:53-54`). Verify by listing
  `pre-push`/`pre-commit` at whichever path resolves; on macOS they are **symlinks** (`lrwxr-xr-x`)
  by design, copies only on Windows.
- `diskutil info /` has **no** `Case-Sensitive` field on current macOS. Test what matters instead:
  `ls CLAUDE.md` in the repo — it resolves only on a case-insensitive filesystem, and the root
  context file is git-tracked lowercase as `claude.md`.
- `gh` is not installed by default: `brew install gh`.
- Only the memory directory, the four real `.env` files, `.claude/settings.local.json`, and
  optionally `~/.claude/settings.json` need manual copying. Everything else arrives with the clone.

---

## Standing mechanics

- Branch from `origin/master`; never direct-push to master; never force-push.
- Every merge needs explicit maintainer authorization; `--admin` override needs its own each time.
- No docs-only master pushes — every master push is a full deploy.
- Dependency edits are surgical: no workspace install, dedupe, or lockfile scratch regeneration.
- All four SDLC gates every sprint, calibrated to diff size.
- Landing docs regenerate on `npm test`; revert timestamp/HEAD-sha churn before committing.
- Cross-agent review: the agent that did not author an artifact reviews it.
- **Reconcile this file against `gh pr list` and `git log` before claiming any work complete.**
  A handoff that contradicts real PR state is a blocking defect. It happened **three times in one
  session** (2026-09-04/05): at `9b726c16` the body still described a merged PR as open; after the
  #219 merge the header still named the old branch of record; and its Quick Start still said
  "neither is merged" minutes after one was. Codex caught all three.

  This file is the most staleness-prone artifact in the repo precisely because it is the only one
  carrying cross-session state — every merge, every push, and every review round invalidates part
  of it. Treat "update the handoff" as a step of the action, not a task that follows it.
