# Sprint 123 — AGPL published, every license claim reconciled, the audit recorded

> **Status: implementation COMPLETE on `feature/sprint-123-licensing-and-audit`.**
> All 13 implementation tasks done. Awaiting PR review → merge authorization → deploy.
> Version **v11.42.0 → v11.43.0**.

## Quick Start

1. Read this handoff.
2. `git checkout feature/sprint-123-licensing-and-audit` (branched from `docs/sprint-123-planning`,
   which itself was cut from `origin/master` `e5dc24ce`).
3. If the PR is still open: the remaining work is Task 14 only — merge, deploy, smoke-test,
   reconcile. Everything before it is finished and verified.

| Document | Path |
|---|---|
| Design spec | [`specs/2026-08-07-…-design.md`](../../docs/superpowers/specs/2026-08-07-sprint-123-licensing-and-audit-design.md) |
| Implementation plan | [`plans/2026-08-07-….md`](../../docs/superpowers/plans/2026-08-07-sprint-123-licensing-and-audit.md) |
| Four-sprint arc | [`specs/2026-08-06-…-arc-design.md`](../../docs/superpowers/specs/2026-08-06-sprint-123-126-manifesto-alignment-arc-design.md) |
| ADR-092 | [`ADR-092-agpl-licensing-and-manifesto-audit.md`](../../docs/adr/ADR-092-agpl-licensing-and-manifesto-audit.md) |
| ADR-093 | [`ADR-093-federation-schema-reserved.md`](../../docs/adr/ADR-093-federation-schema-reserved.md) |

---

## What shipped

**Licensing.** `LICENSE` is the canonical GNU AGPL v3 fetched from gnu.org — byte-exact, nothing
appended (662 lines, 34,523 bytes, sha256 `0d96a4ff…`), so GitHub's similarity-based detection
works. The `Copyright (C) 2025-2026 Ravi Chavali` notice lives in `README.md` per GNU's
`gpl-howto`. All **20** tracked manifests declare `"license": "AGPL-3.0-or-later"`, discovered via
`git ls-files`. `.gitattributes` pins `LICENSE` to `eol=lf` so `core.autocrlf=true` cannot check it
out with CRLF. A `.mailmap` collapses the maintainer's five git identities to one author.

**The claim inventory was 14, not 13.** `services/simulation-service/README.md:347` said
*"Internal use only - Karmyq Platform"* — a license claim containing neither "MIT" nor "AGPL", so
every planning-stage grep was blind to it. Found only by reading the three READMEs believed to have
no License section. **A search is only as complete as its vocabulary.**

All 10 service READMEs now carry an *identical* License section, so the invariant is uniform
("every service README states the license") rather than conditional.

**The gate** — `tests/regression/sprint-123-license-consistency-gate.test.ts` — reads 16 prose
sites and 20 manifests, normalizes to a license family, and fails on disagreement, on a null
extraction, and on any new unallowlisted claim. Its service entries derive from
`services/registry.json` and are cross-checked against the READMEs git tracks, so service #11
shipping unlicensed goes red rather than passing.

**The git hooks were inert and nothing said so** (Task 11). `install-hooks.sh` hardcoded
`.git/hooks` while `core.hooksPath` pointed at `.husky`; git reads only the configured path, so
every hook the installer wrote was dead code. Husky is no longer a dependency at all — it left the
config setting behind. Fixed in the installer; the stale `.husky/pre-commit` fork is deleted and
`.husky/` is gitignored as installed artifacts.

---

## ⚠️ Things not to get wrong from here

1. **`npm test` under Turbo flaked twice on this machine** — auth-service and community-service
   reported failures that do **not** reproduce: run directly they are 37/37 and 122/122. Read the
   failing suite name out of the raw output and re-run that workspace directly before believing it.
   Never `| tail` the run — it masks the exit code (that is how the first failure looked like a
   pass).
2. **`gnu.org` returns HTTP 403 to the default Node fetch user-agent.** A browser UA on the same
   canonical URL works. If `LICENSE` ever needs re-fetching, that is the gotcha.
3. **`apps/landing/src/data/docs/` is gitignored by `apps/landing/.gitignore:2`** but 160 files are
   tracked. **New** files in it need `git add -f`; the plan's claim that plain `git add` suffices
   is true only for already-tracked ones.
4. **`git ls-files 'services/*/README.md'` is not a service arbiter** — git's `*` crosses `/`, so it
   also returns the 10 `.claude/README.md` files. Use `services/registry.json`.
5. **`execSync` with a quoted glob returns nothing on Windows** — it routes through `cmd.exe`, which
   does not strip single quotes, so the pattern reaches git as a literal. Use `execFileSync` with an
   argv array. A silently-empty list is how a discovery-based gate goes vacuously green.
6. **The pre-push hook has not yet been observed firing on a real push.** The pre-commit hook fired
   (twice, on this branch's commits). Watch the branch push print `🚀 Running pre-push checks…` —
   **a silent, instant push means the fix did not work, and that silence is the entire bug.**

---

## Task 14 — all that remains

- [ ] Push the branch; **confirm pre-push actually fires** (see #6 above)
- [ ] Open the PR with `pr-contract.yml` headers, both gate outputs (red and green), the license
      decision summary
- [ ] `/code-review` at medium — ⚠️ **maintainer-invoked only**, the agent cannot run it
- [ ] Merge — ⚠️ `gh pr merge --squash --admin` needs **explicit authorization each time**; the Bash
      form is blocked by the permission classifier, use the GitHub MCP `merge_pull_request` tool
- [ ] Monitor GitHub Actions (no migrations this sprint, so no manual SSH step)
- [ ] `gh repo view --json licenseInfo,visibility` — must no longer be `null`. This is the
      externally-visible proof F1 is closed and the reason `LICENSE` had to stay byte-exact
- [ ] Smoke-test with real paths (`/health` 404s through nginx; `curl`/`jq` unusable — `node -e` +
      `fetch`): landing 200 · bodyless `POST /api/auth/login` 400 `VALIDATION_ERROR` · wrong
      password 401 `UNAUTHORIZED`
- [ ] Verify the landing site serves `/docs/concepts/open-source-and-agpl` and the two new ADR pages
- [ ] Flip ADR-092/093 to `Implemented` **folded into the next sprint's PR** — no docs-only master
      push

---

## Quality gates run

| Gate | Result |
|---|---|
| Testing | Both new suites observed **red** on real injections, then green. Details below |
| `/simplify` | 4 parallel reviews. Applied: registry-derived service list, helper extraction, `git grep` instead of 1,500 file reads, generic Footer extractor, table-driven hook proofs. **Surfaced two real installer defects** (see below) |
| `/security-review` | **No qualifying findings.** Noted (and accepted) that the out-of-repo guard is a lexical prefix test — trusted input, accidental-misconfiguration scope |
| `/code-review` | **NOT RUN — maintainer-invoked only.** Do not record it as done |

**Red observed, on every gate, after the refactor** (a refactored gate is an unproven gate):
README badge flipped to MIT · a registry service with no README · the hardcoded `.git/hooks`
target · the case-sensitive path comparison. Each went red, then green on restore, with
`git diff --stat` empty afterwards.

**Two real defects `/simplify` surfaced in my own installer fix:**

1. `git config --get` reads **merged** config, so a machine-global `core.hooksPath` would have had
   the installer write Karmyq's hooks into a directory shared by every repo on the machine — and
   `rm "$target"` deletes what was there first. Now refuses when the path resolves outside the repo.
2. That refusal then **rejected this repo**: `git rev-parse --show-toplevel` returns `C:/…` while
   `core.hooksPath` holds `c:\…`, and the prefix test was case-sensitive, so `hooks:install`
   installed nothing. Caught by *re-running the installer* rather than assuming it still worked.

---

## Standing state

- **Version:** v11.43.0 on the branch; `origin/master` is still v11.42.0, deployed.
- **Branch:** `feature/sprint-123-licensing-and-audit`, 3 commits on top of the planning branch.
- **Highest ADR is 093.** 094 is free.
- **`docs/sprint-123-planning`** can be deleted once this merges.
- ⚠️ **Untracked and unrelated:** `.github/copilot-instructions.md`, `.github/instructions/`
  (mermaid tooling, 2026-07-29). Deliberately left out of this PR.

### Carried debt (none blocks the merge)

- **BUG-035** (logged this branch): the `Expo SDK drift` workflow is permanently red and has no
  exemption mechanism, so it can never go green and files/updates issue **#196** on every run. It
  buries 5 genuine Expo patch releases. Deliberately **not** folded into S123 — arc-design D6.
- `README.md:2` still shows a hardcoded `version-10.11.0` badge. Out of this sprint's scope; the
  drift gate only guards CLAUDE.md's version line.
- `redisClient.publish` UNPROVEN — needs a seeded conversation (S125).
- `mark-read` unimplemented — `markMessagesAsRead` exists and is never called. Needs a bug entry.
- ADR-028's new-service Dockerfile template still shows `node:18-alpine`; the ADR-090 runtime-floor
  gate will fail any new service that copies it.
- `.npmrc` `engine-strict` still unset.
- **#190** regenerated Expo held bumps · **#192** dev-deps.
- `scripts/setup/git-hooks/` is a third copy of the hook sources. Its installer now refuses to run;
  consolidating the copies is still open.

---

## Next: Sprint 124 — provider standing

Enforce `provider_services_enabled` and `provider_min_personal_trust_score` at the **community
surface**. F2/F3 from the audit, recorded in ADR-092 with their open questions intact.

**Both product questions are genuinely undecided and belong to S124's planning:**
(a) does standing gate *global registration* as well as community reach, or only reach?
(b) what happens to the unauthenticated global provider directory (`providers.ts:27`, ranked
`trust_score DESC`) — leave public, require auth, restrict to shared communities, or retire it?

⚠️ **This is the manifesto contradicting ADR-041, not code drifting from its ADR.** ADR-041:53
deliberately specifies open self-registration. Changing that is a decision, not a bug fix.

Then S125 (demo backfill — **first task is fixing `TimeTravelFactory`**, which violates the replay
constraint it appears to satisfy) and S126 (live simulation across all users).
