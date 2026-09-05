# Current Handoff — as of 2026-09-04

**Version:** v11.46.0 · **Branch of record:** `master` at `9083a79a` · **Demo:** deployed and healthy

---

## 🔀 Active lanes

Parallel development runs from two checkouts on two machines (Windows primary, Mac second). When
lanes are active, find your branch below and read/update **only that lane's file**.

| Lane | Machine | Branch | Handoff file | Sprint |
|---|---|---|---|---|
| _(none active yet)_ | — | — | — | — |

⚠️ **This table is a pointer, not a coordination store.** It is a branch-local file, so it can be
stale and it is **never** the authority on who owns a contended resource. Derive those from their
live arbiters — see `CLAUDE.md` → *Parallel Development* → **Why reservations do not work here**
(ADR numbers, version bump, dependency lane, merge slot, demo data ops).

---

## Quick Start — read this, then pick from Outstanding below

1. `git fetch origin` and confirm real state before trusting anything written here:
   `gh pr list` and `git log --oneline origin/master -3`.
2. Two artifacts are **open and awaiting review** (details below). Neither is merged.
3. Nothing is mid-implementation. There is no half-finished task to resume.

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

### PR #219 — parallel-dev process, Sprint 126 post-deploy docs, BUG-038
Branch `docs/sprint-126-post-deploy-state`. **All checks green**; `mergeStateStatus: BLOCKED`
solely on the required approving review. Carries the `Parallel Development` rules in `CLAUDE.md`,
the `AGENTS.md` topology rewrite, the handoff lane convention, and BUG-038.

**Codex reviewed three rounds** (`9b726c16`, `ccbc1bbf`, `ad6b38f3`). Round 1: reservations not
reliably shared between branches; self-contradictory handoff. Round 2: ADR allocation still raced
and the backstop this PR *claimed* did not exist; an open Dependabot PR permanently occupied the
dependency lane. Round 3: superseded rules left in the summary table. All fixed on the branch.

The durable correction: **querying live state establishes what is visible; allocating ownership
still requires serialization.** ADR numbers, the dependency lane and demo operations are now
maintainer-allocated, and ADR uniqueness is enforced by a real gate
(`tests/regression/doc-context-drift-gate.test.ts`, 5 → 7 tests, with a negative fixture proving it
fails on two `ADR-097` files).

### Design spec — ecosystem knowledge registry (Sprint 127 candidate)
Branch `docs/sprint-127-knowledge-registry-spec`, commit **`c56935ad`**, no PR opened.
`docs/superpowers/specs/2026-09-04-ecosystem-knowledge-registry-design.md`.

Proposes `docs/gotchas/` — a home for operational knowledge that today lives only in one
maintainer's private agent memory and reaches nobody else. Every entry carries exactly one of a
declarative machine check or an expiry date. **Two Codex rounds are integrated.** Round 1: renewal
rule too blunt, doc-agreement gate asserted weaker than it claimed, `js-yaml` undeclared, plus asks
on discovery, scope and credential screening. Round 2: the renewal rule needed information the
schema cannot express (promotion is now a reviewer decision, not a validator rule), and `scope`
must name git-tracked paths rather than machine-local ones.

**Format decided: JSON sidecars** (one `.json` + one `.md` per entry, orphans rejected), which
takes no new dependency — so **this lane is dependency-independent** and can run concurrently with
the ADR-059/exemptions work. Codex has **no further design objections to implementation planning**
once the remaining text reconciliation lands.

**No implementation has begun and none should** until the spec is approved.

---

## Outstanding — rough priority

1. **BUG-038 — ADR-059 gate cannot distinguish "no advisories" from "no answer."** Independently
   reproduced by Codex with a synthetic error response: empty registry passes, shipped registry
   blocks with misleading removal advice. **The pattern to copy already exists in-repo** —
   `tests/regression/sprint-122-adr-060-code-scanning-gate.test.ts:361-374`, "ADR-060 gate —
   refuses to fail open on API errors". Strong Sprint 127 candidate.
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
  A handoff that contradicts real PR state is a blocking defect — it happened at `9b726c16` and
  Codex caught it.
