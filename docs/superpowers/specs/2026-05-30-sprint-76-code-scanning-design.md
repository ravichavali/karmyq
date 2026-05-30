# Sprint 76: Code Scanning Remediation + Supply-Chain Hardening — Design Spec

**Date**: 2026-05-30
**Status**: Approved
**Version**: v10.4.0 → v10.5.0
**Sprint Branch**: `feature/sprint-76-code-scanning`

---

## Overview

Sprint 75 cleared every known-CVE dependency vulnerability and made the dependency audit a blocking CI gate (ADR-059). The code-scanning side of the house is still open: GitHub CodeQL reports **15 open alerts** (10 critical, 5 high) and there is **no gate** preventing new ones from accumulating. This is the exact same debt pattern Sprint 75 closed for dependencies — now applied to first-party code.

This sprint is a **triage-and-gate** sprint, not a rewrite. Most of the alerts are CodeQL over-reporting against a fixed-host API client; a few are real, cheap hardening wins. Each alert gets an explicit per-alert disposition: **harden the real ones, dismiss the false positives with a written justification**. Once the board is resolved-or-dismissed, we activate a **blocking code-scanning gate** — codified as **ADR-060** — so the same "never silently reaccumulate" discipline now covers CodeQL.

**Scanner configuration is upgraded first, before triage.** An audit of the live settings (2026-05-30) found CodeQL running the conservative `default` query suite with a `remote`-only threat model — i.e. the current 15 alerts reflect *partial* coverage, not a clean bill of health. ADR-060 therefore also bumps CodeQL to **`security-extended` + `remote_and_local`**, which will surface additional alerts that must be triaged in this same sprint before the gate can flip. This closes the "green board, partial scan" false-assurance gap explicitly.

Because this is a security-themed sprint, we also fold in **supply-chain & secrets hardening** from the backlog — codified as **ADR-061**: the install-script/lockfile quick wins (ignore-scripts, `npm ci` everywhere, `npm audit signatures`), plus a behavioral/provenance SCA step (**OSV-Scanner**) for the malicious-package class that CVE audits miss, a review-gated **`dependabot.yml`**, and enabling **secret-scanning validity checks + non-provider patterns** (both currently disabled).

### Core Principle: Triage with a paper trail, then gate

Every alert is either fixed or dismissed-with-a-reason — no alert is left in an ambiguous "open but ignored" state. Only once the board is at zero do we flip the gate to blocking, identical to the dependency-gate discipline. A dismissal is a security decision and gets the same written justification a fix would get in a commit message.

---

## Multi-Sprint Arc

### Sprint 75 — Dependency Vulnerability Remediation (complete)
31 npm-audit vulns → 0; blocking `npm audit --audit-level=high` CI gate (ADR-059); v10.4.0.

### Sprint 76 — Code Scanning Remediation + Supply-Chain Hardening (this sprint)
15 CodeQL alerts → 0 (fix-or-dismiss); blocking code-scanning gate (ADR-060); supply-chain hardening quick wins (ADR-061); v10.5.0.

### Sprint 77 — Trust Graph Viz Polish + Depth (upcoming)
Unify ego/relationship views onto the structure-first graphical style; fix the SUM(current_weight) vs SUM(raw_weight) sizing/scoring inconsistency; inter-community zoom. (Scope preserved in handoff.)

### Backlog — Supply-Chain Hardening, remainder
Items 4–5 (dependabot.yml review-gating, CI token hygiene) remain after this sprint folds in items 1–3.

---

## New Concepts

- **Code-scanning gate** — a blocking CI check that fails the build when GitHub code scanning reports an open **critical or high** alert on the pushed commit. Distinct from the dependency-audit gate (ADR-059): different alert source (CodeQL static analysis of first-party code, not npm audit of the dependency tree), different ADR (060), same SLA.
- **Disposition** — the per-alert decision recorded during triage: `fix` (code change clears it) or `dismiss:false-positive` / `dismiss:wont-fix` (with written justification via the code-scanning API/UI).
- **Install-script execution gate** (`ignore-scripts`) — npm lifecycle scripts (`postinstall`, etc.) are the primary execution vector for self-propagating supply-chain worms. Disabling them by default and running trusted scripts explicitly removes that vector.

---

## Alert Triage — all 15, with dispositions

### SSRF — `js/request-forgery` (10 × critical) — all in `apps/frontend/src/lib/api.ts`

| Alert | Line | Disposition |
|-------|------|-------------|
| 82–84, 92–94, 98 | 341–360 | `dismiss:false-positive` — user-controlled value is a **path segment** (`communityId`, `activityId`, `nominationId`) interpolated into a request against a **fixed-host** axios client whose `baseURL` is `process.env.NEXT_PUBLIC_*`. The host is never attacker-controlled, so no server-side request forgery is possible. |
| 86, 97, 119 | 803, 825, 828 | `fix` (harden) **then** `dismiss:false-positive`. Same fixed-host reasoning, but [api.ts:803](apps/frontend/src/lib/api.ts#L803) (`validateInvitationCode`) uses **raw `axios`** with an unencoded `invitationCode` — wrap path params in `encodeURIComponent` as defense-in-depth before dismissing. |

**Why all are false positives:** CodeQL's `js/request-forgery` flags tainted data reaching the URL of an outbound request. It cannot see that the taint only ever lands in the **path**, never the **host/origin** (which is a fixed env-configured constant). There is no open redirect or host-injection path. We harden the cheap cases (path-param encoding) and dismiss all 10 with this justification.

### XSS — `js/xss-through-dom` (3 × high)

| Alert | Location | Disposition |
|-------|----------|-------------|
| 88 | [Movement.tsx:11](apps/landing/src/components/sections/Movement.tsx#L11) | `fix` — user-typed `email` is concatenated into `window.location.href = \`mailto:...${email}\``. Real sink. Wrap with `encodeURIComponent(email)` (and trim/validate). Cheap, correct. |
| 89, 90 | [communities/index.tsx:432-433](apps/frontend/src/pages/communities/index.tsx#L432) | `dismiss:false-positive` — value is a JWT-sourced community `id`/`name` rendered as React children + a **relative** `href={\`/communities/${c.id}\`}`. React escapes children; the href is prefixed with a fixed path so it can never form a `javascript:` scheme. Not exploitable. |

### Insecure randomness — `js/insecure-randomness` (2 × high) — `services/simulation-service`

| Alert | Location | Disposition |
|-------|----------|-------------|
| 117 | [dibs-workflow.ts:22-23](services/simulation-service/src/workflows/dibs-workflow.ts#L22) | `dismiss:wont-fix` — `Math.random()` selects a random prior request/provider in the **simulation engine**. Non-security context: not a token, password, or nonce; simulation-service generates synthetic demo data and is not on any auth/crypto path. |
| 118 | `services/simulation-service/src/api-client.ts:431` | `dismiss:wont-fix` — same justification. |

**Net code changes:** ~2 small edits (encode path params in `api.ts`; encode `email` in `Movement.tsx`). Everything else is a documented dismissal.

---

## Code-Scanning Gate Design (ADR-060)

**Current state:** CodeQL runs via GitHub **default setup** (configured in repo settings, *no committed `codeql.yml`*). Default setup uploads results to the code-scanning dashboard but does **not** fail any CI job on findings.

**Chosen approach — a committed gate job that queries the code-scanning API:** Add a `code-scanning-gate` job (in `.github/workflows/ci.yml`, parallel to the existing `security:` dependency job) that, on push/PR, queries the code-scanning alerts API for the pushed ref and **exits non-zero if any open `critical` or `high` alert exists**. This mirrors ADR-059's pattern exactly (a CI job that fails the build), is fully version-controlled, and — crucially — does **not** require disabling default-setup CodeQL or switching the repo to advanced setup (which would conflict with default setup and is not version-controlled).

**Why not branch-protection required status check alone:** This repo pushes **directly to master** (CI/CD deploys on push). A required-PR status check would change the core dev workflow and isn't version-controlled. The gate job is the consistent, file-based control; branch protection is documented in ADR-060 as the complementary GitHub-native option but is **not** the primary mechanism.

**Timing note (critical):** Default-setup CodeQL analysis runs asynchronously and may not have completed when the gate job runs on the same push. The gate job **polls** the code-scanning API for an analysis on the pushed SHA (bounded retry/timeout), then evaluates open critical/high. If no analysis is available within the timeout, the job reports inconclusive — see Critical Implementation Notes for the exact fail-open-vs-fail-closed decision.

**SLA (same as ADR-059):** no critical/high code-scanning alert open > 1 week; no alert of any severity open > 2 weeks.

### Scanner configuration upgrades (part of ADR-060)

Live-settings audit (2026-05-30, `gh api .../code-scanning/default-setup`) found:

| Setting | Current | Target | Why |
|---------|---------|--------|-----|
| `query_suite` | `default` | **`security-extended`** | The default suite deliberately skips many security queries to keep noise low. Extended runs the full security set — more real findings. The current 15 alerts are *partial coverage*. |
| `threat_model` | `remote` | **`remote_and_local`** | `remote` only taints network input. `remote_and_local` also taints local sources (files, env, CLI args) — relevant given the simulation tooling + scripts. |

Applied via `gh api -X PATCH repos/:owner/:repo/code-scanning/default-setup` (stays on **default setup** — no advanced `codeql.yml`). **Consequence (must be planned for):** the upgraded suite will surface *new* alerts on the next scan. Those are triaged in this same sprint (same fix-or-dismiss discipline) and the gate cannot flip to blocking until the **re-scanned, extended** board is at zero. This is why config-upgrade-then-rescan precedes triage in the plan.

**Secret scanning** (separate control, already enabled) gets two free upgrades, documented under ADR-061: enable **validity checks** (tells you if a leaked credential is still live) and **non-provider patterns** (catches generic secrets, not just known-provider formats). Both currently `disabled`.

---

## Supply-Chain & Secrets Hardening (ADR-061)

Distinct from ADR-059 (known-CVE deps) and ADR-060 (first-party code scanning). These close install-script / lockfile-drift / malicious-package / leaked-secret vectors used by self-propagating worms (Shai-Hulud class).

**Install-script & lockfile quick wins:**
1. **`ignore-scripts=true` in `.npmrc`** — lifecycle scripts (the worm execution vector) no longer run automatically on `npm install`/`npm ci`. **Gotcha:** the root `postinstall` currently auto-runs `scripts/install-hooks.sh`. With scripts ignored, git-hook installation must move to an **explicit** `npm run hooks:install` (documented in CLAUDE.md + README), and CI jobs that rely on no build scripts are unaffected. Packages that legitimately need build scripts (none currently block CI) would be allowlisted explicitly if discovered.
2. **`e2e-tests.yml`: `npm install` → `npm ci`** (lines 26, 50) — every other workflow already uses `npm ci` (deterministic, lockfile-pinned). `npm install` can silently float to a newer (potentially poisoned) version. This is the last `npm install` in CI.
3. **`npm audit signatures` step in CI** — verifies registry provenance/signatures on the installed tree, catching tampered packages that pass the CVE audit.

**Detective + process additions:**
4. **OSV-Scanner CI step** — Google's OSV scanner draws on a broader advisory DB than `npm audit` (which is npm-advisory-only). Committed CI step (no GitHub App, no PR required — fits the direct-push workflow). Non-blocking informational first, then decide gating. *Note:* OSV is still advisory-based; it broadens CVE coverage but does not, by itself, catch a brand-new malicious package. The **Socket GitHub App** (behavioral analysis of install scripts / new maintainers / obfuscation) is the recommended complement for that class and is documented in ADR-061 as a recommended console install (its PR-comment value is limited under direct-push, so it's a recommendation, not a committed CI gate).
5. **`.github/dependabot.yml`** — review-gated, **grouped** security + version update PRs; **no auto-merge** (auto-merge would itself be a supply-chain ingestion path — see backlog item 4). Stops the Sprint-75 alert pile-up from silently recurring.

**Secret-scanning toggles** (validity checks + non-provider patterns) per the table above — `gh api -X PATCH repos/:owner/:repo` with the `security_and_analysis` fields.

**Verification burden:** changing `.npmrc` to `ignore-scripts=true` means a fresh `npm ci` will **not** install git hooks — the executor MUST confirm `npm run hooks:install` still works and update onboarding docs so hooks aren't silently lost for the next developer.

**Workflow note (decided, not changed this sprint):** the *strongest* code-scanning gate is a PR-based merge to master with GitHub's native check-failure severity threshold (deterministic, no polling race). The owner chose to **keep direct-push-to-master** + the best-effort poll-gate for now; PR-based gating is recorded as a future option in ADR-060, not adopted here.

---

## Data Model

No schema changes this sprint.

---

## API Endpoints

No new or modified application endpoints. (Changes are to `.github/workflows/`, `.npmrc`, two frontend source files, and docs.)

---

## Frontend Changes

| File | Change |
|------|--------|
| `apps/frontend/src/lib/api.ts` | Wrap path params in `encodeURIComponent` for the raw-`axios`/unencoded cases (≥ `validateInvitationCode` at line 803); defense-in-depth before dismissing the SSRF alerts. |
| `apps/landing/src/components/sections/Movement.tsx` | `encodeURIComponent(email)` (+ trim/basic validate) in the `mailto:` href assignment — clears the one real XSS alert. |

No visual or behavioral change to either app.

---

## User Guide & Doc Updates

Every sprint ships docs. This sprint's user-facing surface is the security/CI posture, so the docs are concept + ADR pages (not workflow guides):

- **`docs/adr/ADR-060-code-scanning-gate.md`** — new ADR: the blocking code-scanning gate, the CodeQL config upgrades (`security-extended` + `remote_and_local`), disposition discipline, SLA, default-setup-API-poll design, PR-gate-as-future-option.
- **`docs/adr/ADR-061-supply-chain-and-secrets-hardening.md`** — new ADR: `ignore-scripts`, `npm ci` everywhere, `npm audit signatures`, OSV-Scanner (+ Socket recommendation), `dependabot.yml`, secret-scanning validity + non-provider toggles; the install-hooks tradeoff.
- **`docs/adr/README.md`** — index both ADRs.
- **Landing concept pages** (mirror `adr-059-dependency-security-gate.json`):
  - `apps/landing/src/data/docs/concepts/adr-060-code-scanning-gate.json`
  - `apps/landing/src/data/docs/concepts/adr-061-supply-chain-and-secrets-hardening.json`
  - Add both to `nav.json` "Architecture Decisions" (grep-verify after — nav.json revert bug).
- **`docs/GITHUB_ACTIONS_SETUP.md`** — extend the security section (added in Sprint 75) with the code-scanning gate + supply-chain hardening, and the **`npm run hooks:install` is now manual** note.
- **`CLAUDE.md` / root `README`** — document that `ignore-scripts=true` means hooks install explicitly via `npm run hooks:install` (postinstall no longer auto-runs it).
- **Pre-Merge Checklist (CLAUDE.md §5)** — already references ADR-059/060 generically; confirm ADR-060 is now real and linked.

---

## Critical Implementation Notes

1. **CodeQL is GitHub default setup — there is NO committed `codeql.yml`.** Do not add an advanced-setup `codeql.yml`; it conflicts with default setup (GitHub rejects advanced uploads while default setup is on). The gate is a **CI job that queries the code-scanning alerts API**, not a CodeQL workflow.
2. **Gate timing / fail-closed decision.** Default-setup analysis is async. The gate job MUST poll for an analysis on the pushed SHA with a bounded timeout. Decision: if analysis exists and shows open critical/high → **fail (blocking)**; if no analysis within timeout → log a warning and **pass** (fail-open on missing-analysis only, never on present-findings), because a hard fail-closed on async-timing would block every push spuriously. Document this explicitly in ADR-060.
3. **Dismissals require the API, not a code change.** Dismissing an alert is done via the code-scanning API (`PATCH .../code-scanning/alerts/{number}` with `state=dismissed`, `dismissed_reason`, `dismissed_comment`) or the UI — each with the written justification from the triage table. The gate can't go green until the 13 dismissals + 2 fixes are all done.
4. **`encodeURIComponent` may not auto-clear the CodeQL SSRF alerts.** CodeQL doesn't always recognize path-encoding as a sanitizer for `js/request-forgery`. Harden anyway (it's correct), but expect to still **dismiss** those alerts with justification — the encoding is defense-in-depth, the dismissal is the alert-clearing action.
5. **`ignore-scripts=true` breaks auto hook-install.** Root `postinstall` runs `scripts/install-hooks.sh`. After this change, a clean `npm ci` will NOT install git hooks. MUST: verify `npm run hooks:install` works standalone, update CLAUDE.md + README + GITHUB_ACTIONS_SETUP.md, and confirm CI doesn't silently depend on a lifecycle script.
6. **Upgrade the CodeQL suite FIRST, then re-scan, then triage.** Bumping to `security-extended` + `remote_and_local` (via `gh api -X PATCH .../code-scanning/default-setup`) will surface *new* alerts. Trigger/await a fresh analysis before triage so the triage set is the *extended* set — not the stale 15. The gate cannot flip until the extended board is at zero. (If the PATCH doesn't auto-trigger a scan, push a no-op commit or wait for the next push to re-run default setup.)
7. **Can't flip the gate to blocking until the board is at zero** — same discipline as ADR-059. Order: upgrade suite → re-scan → triage/fix/dismiss the full set → confirm 0 open critical/high → enable the gate job → verify it would have blocked (negative test).
8. **OSV-Scanner is advisory-based, not behavioral.** It broadens CVE coverage beyond `npm audit` but won't catch a brand-new malicious package. Add it as the committed CI step; recommend the **Socket GitHub App** in ADR-061 as the behavioral complement (console install, not a committed gate under direct-push).
9. **`dependabot.yml`: review-gated, grouped, NO auto-merge.** Auto-merge is itself an ingestion path. Keep PRs human-reviewed.
10. **ADR numbering:** 060 = code-scanning gate (+ CodeQL config upgrades), 061 = supply-chain & secrets hardening. 059 (dependency gate) stays dependency-only.
11. **Landing docs dir is `.gitignore`d** — `git add -f apps/landing/src/data/docs/...`. **nav.json revert bug** — grep-verify nav entries after `generate-docs`; re-apply if reverted.
12. **Version bump 10.4.0 → 10.5.0** (minor — ships a new behavioral CI gate, mirroring Sprint 75's 10.3.0→10.4.0). Update root `package.json`.
13. **`e2e-tests.yml` is the only remaining `npm install`** (lines 26, 50). Switch both to `npm ci`. Confirm a lockfile is present at those install roots (it is — single root lockfile).
14. **Secret-scanning toggles are `gh api -X PATCH repos/:owner/:repo`** on `security_and_analysis` (validity checks + non-provider patterns). Not a file change; document in ADR-061 + GITHUB_ACTIONS_SETUP.md.
