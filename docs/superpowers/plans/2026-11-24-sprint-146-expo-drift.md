# Sprint 146: Expo SDK Drift Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> **Subagent models:** implementers and per-task reviewers run on `sonnet` (`haiku` for a
> one-file mechanical task); only the final whole-branch review runs on `opus`. Pass the
> model on every dispatch; SDD's fix-loop escalation still applies.

**Goal:** Align the nine drifted Expo SDK-57 pins in `apps/mobile` to Expo's live version map,
prove the existing drift gates green, close #329, and land the Deepmerge #178 re-check as an
ADR-059 documentation reconciliation, shipping as v11.119.0.

**Architecture:** Pure dependency-alignment sprint. The arbiter is Expo's live map via
`npx expo install --check`; the committed shadows (`tests/regression/sprint-122-expo-sdk-alignment.test.ts`,
`scripts/expo-divergences.js`, `security/expo-divergences.json`) already enforce the contract
and need no edits. Only `apps/mobile/package.json`, `package-lock.json`, ADR-059, mobile
docs, and the version strings change.

**Tech Stack:** the canonical stack in `CLAUDE.md` → *System Architecture*. Do not restate
version numbers here — a pinned example goes stale and then gets copied into specs.

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| — | None. The enforcement gates already exist; this sprint makes them green. |

### Existing files to modify
| File | Change |
|------|--------|
| `apps/mobile/package.json` | Nine SDK-managed ranges bumped to the live-map values captured in Task 1 |
| `package-lock.json` | Nine hoisted entries (`node_modules/<pkg>`) spliced: version, resolved, integrity, any dep deltas |
| `docs/adr/ADR-059-dependency-security-gate.md` (~line 524) | Deepmerge paragraph amended: advisory withdrawn 2026-11-16, re-check completed 2026-11-24, obligation closed |
| `apps/mobile/claude.md` | Recent-changes line for the alignment (v11.119.0) |
| `package.json` / `package-lock.json` (root) | Version → v11.119.0 (four-line lock diff, Sprint 145 pattern) |
| `.claude/handoff/CURRENT_HANDOFF.md` | Rewritten for the executing conversation; #178 leaves open candidates |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **Never trust a drift number older than the run that produced it.** Capture
   `npx expo install --check` (or `node scripts/expo-divergences.js`) output at execution time
   and bump to *those* values. The issue's numbers and the spec table are evidence, not
   instructions. If the live map differs, the live map wins; if it moved a `SDK_PINNED` package,
   that map entry changes too, with a written reason per its comment contract.
2. **Lockfile edits are surgical.** Never `npm install --workspace`, never `npm dedupe`, never a
   scratch regen. Edit the nine hoisted `package-lock.json` entries in place (version, resolved,
   integrity from `npm view <pkg>@<version> dist.tarball dist.integrity`), diff each entry's
   `dependencies`/`peerDependencies` between old and new and splice any change, then prove with a
   strict `npm ci`.
3. **Do not touch the registered divergences.** `security/expo-divergences.json` stays as-is;
   removing a still-matching entry fails the gate, and widening one to hide drift is forbidden
   (ADR-094).
4. **The gate must report exactly two cleared divergences and zero blocking drift.** Any other
   shape (a stale entry, an unparsed row, exit status other than 0/1) is a gate failure, not a
   partial success.
5. **Windows host.** `scripts/expo-divergences.js` already wraps `npx` in `cmd.exe` on win32;
   use the script rather than hand-running npx for the authoritative result. Use `node -e` for
   lockfile inspection; `jq` is absent in Git Bash.
6. **Deepmerge work is documentation only.** No dependency edit, no upgrade, no registry entry;
   the live re-check evidence (withdrawn advisory, closed PR, zero open alerts) is cited in
   ADR-059 verbatim.
7. **No new tests are added.** The enforcement already exists — the sprint-122 alignment test,
   the sprint-124 divergence-gate regression test, and the daily drift workflow are the red→green
   proof. This sprint makes them green; it does not extend them. If the live map surprises us
   (e.g. a `SDK_PINNED` move), tests-first applies to any gate edit.

---

## Task 1: Branch state + live drift capture

**Files:**
- Modify: none (evidence only)

- [ ] Confirm the branch is `agent/claude/sprint-146-planning` at `013d4923` plus this plan's
      commit; `git fetch origin && git log --oneline origin/master -3` still shows `95d5e8c1`
      on top. If master moved, stop and re-plan — the base changed.

- [ ] Run the authoritative gate and save its exact output for the PR validation ledger:

```bash
node scripts/expo-divergences.js
```

- [ ] Record the captured drift table (package, installed, expoPins) in the PR ledger. As of
      2026-11-24 the nine are: @expo/metro-runtime → ~57.0.19, expo → ~57.0.34,
      expo-constants → ~57.0.25, expo-image-picker → ~57.0.22, expo-linking → ~57.0.14,
      expo-location → ~57.0.24, expo-notifications → ~57.0.26, expo-router → ~57.0.32,
      expo-splash-screen → ~57.0.12. **The captured output supersedes this list if they differ.**

- [ ] Verify no `SDK_PINNED` (non-expo-prefixed) package appears in the captured drift. If one
      does, extend Tasks 2–3 to that package and add a written reason to the `SDK_PINNED` map
      comment per its contract.

- [ ] **Verification:** gate exits 1 with exactly the nine `BLOCKING` rows and two
      `REGISTERED DIVERGENCE` rows (jest, @types/jest); nothing else.

## Task 2: Bump the nine manifest ranges

**Files:**
- Modify: `apps/mobile/package.json`

- [ ] Edit the nine `dependencies` ranges in place to the values captured in Task 1 (spec
      section "The drift" is the expected shape). Change nothing else — not `react`,
      not the `expo.install.exclude`, not devDependencies.

- [ ] **Verification (TDD red case):** the sprint-122 test
      `tests/regression/sprint-122-expo-sdk-alignment.test.ts` test "the lockfile satisfies every
      apps/mobile declaration" now FAILS, naming each bumped package with
      `lock has <old>, manifest wants <new>` — that red run is the required pre-implementation
      evidence:

```bash
npx jest tests/regression/sprint-122-expo-sdk-alignment.test.ts --runInBand
```

## Task 3: Surgical lockfile splice + strict proof

**Files:**
- Modify: `package-lock.json`

- [ ] For each of the nine packages, fetch the registry metadata (Windows host — use node/npm,
      not curl/jq):

```bash
npm view <pkg>@<new-version> dist.tarball dist.integrity dependencies peerDependencies --json
```

- [ ] Verify each package resolves to a **hoisted** entry — confirmed at planning time via
      `node -e` over `package-lock.json` (`apps/mobile/node_modules/<pkg>` absent,
      `node_modules/<pkg>` present for all nine). Re-check before editing; if any is nested,
      splice the nested path instead.

- [ ] Splice each hoisted entry in place: `version`, `resolved`, `integrity`. Diff old vs new
      `dependencies`/`peerDependencies` from the registry metadata and splice any change
      (patch bumps usually change none — record "no dep delta" per package in the PR ledger if
      so). Do not let any other lock entry change; review the final lock diff hunk-by-hunk.

- [ ] **Verification (strict proof):** on Windows run `npm ci` from an uppercase `C:\` working
      directory — a lowercase `c:\` cwd writes workspace junctions that crash later `npm ls`
      (recorded gotcha, `apps/mobile/claude.md`):

```bash
npm ci
```

then re-run the Task 2 red test — it must now pass:

```bash
npx jest tests/regression/sprint-122-expo-sdk-alignment.test.ts --runInBand
```

## Task 4: The drift gates go green

**Files:**
- Modify: none

- [ ] **Verification — the arbiter itself:**

```bash
npx expo install --check
```

run from `apps/mobile`, exits **1** with **exactly the two jest rows** (jest → ~29.7.0,
@types/jest → 29.5.14). That is the designed steady state while the ADR-094 divergences stand:
the raw arbiter lists them as outdated, the committed gate subtracts them (the sprint-124
regression test encodes `status: 1` with both jest rows as the *passing* input). Raw exit 0
would mean the jest pins stopped diverging — the registry entries would go stale and the gate
would fail, so exit 0 here is itself a failure mode requiring registry reconciliation, not
success. The exit-0 check is the committed wrapper in the next bullet (also run in Task 1).

- [ ] **Verification — the committed gate:**

```bash
node scripts/expo-divergences.js
```

must exit 0 and print exactly two `REGISTERED DIVERGENCE` lines (jest, @types/jest) followed by
`✅ Expo divergence gate clean (2 registered divergence(s)).` — no `BLOCKING`, no `❌`.

- [ ] **Verification — the divergence-gate regression test:**

```bash
npx jest tests/regression/sprint-124-expo-divergence-gate.test.ts --runInBand
```

must pass unchanged.

## Task 5: Mobile tests + type check + root regression

**Files:**
- Modify: none

- [ ] **Verification — mobile suite and types:**

```bash
cd apps/mobile && npm test
cd apps/mobile && npm run type-check
```

- [ ] **Verification — full root regression** (the sprint-122/124 files must be included in
      the run, not skipped by cache assumptions):

```bash
npm test
```

Record exit status, suite counts and any cache notes in the PR validation ledger.

## Task 6: Deepmerge #178 re-check — ADR-059 reconciliation

**Files:**
- Modify: `docs/adr/ADR-059-dependency-security-gate.md`

- [ ] Re-verify the live evidence before writing (all three, cite the fresh output):
      `gh api advisories/GHSA-gcqx-w48m-w2h4` (withdrawn_at), `gh pr view 178 --json state`
      (CLOSED), open code-scanning alerts on master (`gh api repos/ravichavali/karmyq/code-scanning/alerts`, 0 open).

- [ ] Amend the deepmerge paragraph (~line 524): record that GHSA-gcqx-w48m-w2h4 was withdrawn
      2026-11-16T18:55:38Z, that the due-by-2026-12-01 re-check was completed in Sprint 146
      (2026-11-24) with PR #178 closed and zero open code-scanning alerts, and that the
      "low with no fix, below the gate floor" reasoning is moot — the advisory no longer exists.
      No registry entry, no upgrade, no exemption change.

- [ ] **Verification:** `grep -n deepmerge docs/adr/ADR-059-dependency-security-gate.md` shows the
      amended paragraph with the withdrawal date; `node scripts/expo-divergences.js --registry-only`
      still exits 0 (registry untouched).

## Task 7: Version bump v11.119.0 + mobile doc line (docs task)

**Files:**
- Modify: `package.json`, `package-lock.json`, `apps/mobile/claude.md`

- [ ] Root `package.json` version → `11.119.0`; lockfile `version` and `packages[""].version`
      → `11.119.0` (the version-only lock diff, same pattern as the v11.118.0 commit `95d5e8c1`,
      whose lockfile stat was 4 diff lines: the two version entries, one add + one delete each).

- [ ] Add a Recent-changes line to `apps/mobile/claude.md`: the nine SDK-managed pins aligned
      to the live SDK-57 map, drift gate green, v11.119.0.

- [ ] **Verification:** `node -e "console.log(require('./package.json').version)"` prints
      `11.119.0`; `git diff --stat` for the lockfile shows the version hunks only beyond the
      Task 3 splice; no `apps/landing` content delta exists (no user-facing change — record the
      assessment in the PR body per the spec).

## Task 8: Handoff rewrite for the executing conversation

**Files:**
- Modify: `.claude/handoff/CURRENT_HANDOFF.md`

- [ ] Rewrite the handoff per the sprint-planning skill: Sprint 146 goal, spec/plan links,
      critical implementation notes verbatim, task status table (tasks 1–7 done with SHAs and
      evidence), remaining tasks 9–11, and the persistent-context section carried forward. The
      Deepmerge #178 entry leaves the open-candidates list (closed in Task 6); #329 is closed
      by the PR keyword at merge.

- [ ] Record the Step-5b self-audit line: "self-audit at `<sha>`: N findings fixed" (the audit
      ran during planning; re-run the citation checks at execution and update the count).

- [ ] **Verification:** handoff Quick Start names
      `superpowers:subagent-driven-development` (never `/execute-plan`), names this plan's path,
      and instructs reuse of `agent/claude/sprint-146-planning`.

## Task 9: SDLC quality gates

**Files:**
- Modify: none (gates only); fix what the gates find

- [ ] **`/simplify`** on the branch diff — diff is a nine-range manifest bump, a lockfile splice,
      and docs; expected outcome is "nothing to simplify". Record the result.

- [ ] **`/code-review`** on the branch diff — resolve all correctness findings before merge.
      Pay particular attention to: any lock entry beyond the nine spliced packages, any
      manifest line beyond the nine ranges, and the ADR-059 wording claiming no upgrade where
      the advisory is withdrawn (two different statements; both must be accurate).

- [ ] **`/security-review`** on the branch diff — the dependency-audit standing gate (ADR-059)
      runs on push in CI; the human-level review confirms the splice introduced no unreviewed
      packages (every changed lock entry is one of the nine and matches registry integrity).

- [ ] **Verification:** each gate's result recorded in the PR validation ledger with the SHA of
      the reviewed HEAD.

## Task 10: Final verification

**Files:**
- Modify: none

- [ ] Full type check and the project pre-commit suite (same uppercase-`C:\` cwd caveat as
      Task 3 applies to any npm lifecycle the script touches):

```bash
bash scripts/pre-commit-check.sh
```

- [ ] Retain git pre-commit feedback check and pre-push hooks; record the final green run
      (SHA, exit status, cache state, limitations) in the PR validation ledger.

- [ ] **Verification:** exit 0, and `git status` shows only the intended files changed.

## Task 11: Merge + deploy (maintainer-authorized only)

**Files:**
- Modify: none

- [ ] Open the PR from `agent/claude/sprint-146-planning` with the filled
      `.github/pull_request_template.md` body (the `pr-contract` check fails otherwise),
      including `Closes #329`, the PR validation ledger, and the "no user-facing landing docs
      change" assessment. Use the `/deploy` skill for merge → CI/CD → health verification.

- [ ] **Do not merge without the maintainer's explicit yes** — Sprint 145's merge authorization
      does not carry over. After merge: confirm the next daily `expo-sdk-drift.yml` run is green
      and #329 is closed.

- [ ] **Verification:** PR merged as a squash commit on top of `95d5e8c1`; CI/CD deploy run all
      green; nine services healthy; drift workflow green on its next schedule.
