# ADR-061: Supply-Chain & Secrets Hardening

**Status**: Implemented
**Date**: 2026-05-30
**Sprint**: 76

---

## Context

[ADR-059](ADR-059-dependency-security-gate.md) (dependency audit gate) and [ADR-060](ADR-060-code-scanning-gate.md) (code-scanning gate) close the *known-vulnerability* and *static-analysis* gaps. Neither addresses the **supply-chain ingestion** vector: the path by which a malicious or compromised dependency executes code on a developer machine or in CI. With public release imminent, the recurring real-world pattern is a worm (e.g. "Shai-Hulud"-style) that propagates through **npm lifecycle scripts** (`postinstall`/`preinstall`) and non-deterministic installs. This ADR folds in a set of quick, durable hardening measures against that vector, plus two long-disabled secret-scanning sub-toggles.

---

## Decision

### 1. Block lifecycle scripts on install — `ignore-scripts=true`

`.npmrc` now sets `ignore-scripts=true`. Dependency `pre/postinstall` scripts no longer run on `npm ci` / `npm install`, removing the primary worm execution vector.

**Trade-off — git hooks no longer auto-install.** The root `postinstall` previously ran `scripts/install-hooks.sh`; with `ignore-scripts=true` it would not run, so we **removed the `postinstall` entry entirely** (leaving a dead script that silently never runs is worse than removing it). The `hooks:install` npm script is retained. After cloning, run:

```bash
npm run hooks:install
```

This is documented in `CLAUDE.md`, `README`, and `docs/GITHUB_ACTIONS_SETUP.md`. A clean `npm ci && npm run build` was verified to still succeed with scripts ignored (no dependency in the tree relies on a build-time install script).

### 2. Deterministic installs everywhere — `npm ci`

`e2e-tests.yml` was the last workflow using non-deterministic `npm install` (root install + the `tests/e2e` install). Both are now `npm ci`, which installs strictly from the committed lockfile and fails on lockfile/`package.json` drift. (CI's other jobs already used `npm ci`.)

### 3. Registry provenance check — `npm audit signatures`

The `security:` CI job now runs `npm audit signatures` after `npm ci` — verifying the registry signatures/attestations on the installed tree. **Informational (non-blocking) first**; this ADR records the decision to flip it blocking once the signed-package coverage of our tree is confirmed stable.

### 4. Broader advisory coverage — OSV-Scanner

The `security:` job adds an **OSV-Scanner** step (Google's open-source vulnerability scanner) against `package-lock.json`. OSV draws on a broader advisory database than `npm audit` alone. **Advisory-based, non-blocking first** (`continue-on-error: true`); this ADR is the record for when it flips blocking.

> **Limitation:** OSV-Scanner is *advisory-based* — it catches packages with known CVEs/advisories, **not** a brand-new malicious package that has no advisory yet. The behavioral complement is the **Socket GitHub App** (detects install scripts, network/filesystem access, obfuscation, etc. at the PR level). Socket is a **recommended console install** (not a committed gate, since it's an App, not a workflow), and pairs naturally with the direct-push flow.

### 5. Review-gated dependency updates — `.github/dependabot.yml`

Added Dependabot for `npm` (grouped into `production-deps` / `dev-deps`) and `github-actions`, weekly. **Deliberately NO auto-merge** — an auto-merged bump is itself an ingestion path; every Dependabot PR is human-reviewed before it lands.

### 6. Pin third-party GitHub Actions to commit SHA

CodeQL's `actions/unpinned-tag` rule flagged the third-party `docker/*` actions pinned to floating tags. They are now pinned to full commit SHAs (GitHub-owned `actions/*` are not flagged and are left on tags):

- `docker/setup-buildx-action@8d2750c…` (`# v3`) — in `ci.yml` + `test.yml`
- `docker/build-push-action@ca052bb…` (`# v5`) — in `ci.yml`
- `google/osv-scanner-action/osv-scanner-action@e69cc6c…` (`# v2.0.2`) — the new scanner step

A floating tag can be force-pushed to point at malicious code; a commit SHA cannot.

### 7. Secret-scanning sub-toggles

Secret scanning + push protection were already enabled. Two sub-toggles were attempted via API:

- **Validity checks** — verify whether a leaked credential is still live.
- **Non-provider patterns** — detect generic secrets beyond known-provider formats.

> **Status note:** On this **personal (user-owned) public** repo, the `PATCH /repos/{owner}/{repo}` calls for `secret_scanning_validity_checks` and `secret_scanning_non_provider_patterns` returned 200 but the toggles did **not** persist (the feature appears gated behind an account/org-level setting or the UI for non-org repos). These remain **enabled via the Settings UI** when available; the API path is recorded here for when the repo moves under an org. Core secret scanning + push protection remain on.

---

## Alternatives Considered

1. **`npm config set ignore-scripts` per-CI-job instead of `.npmrc`** — rejected; `.npmrc` makes it the default for *every* install (CI, server, and developer machines), which is the point.
2. **Allow-list specific packages' install scripts** — deferred; nothing in the current tree needs an install script, so a blanket block is simpler and stricter.
3. **Dependabot auto-merge for patch updates** — rejected (ingestion path; see §5).
4. **Making OSV-Scanner / audit-signatures blocking immediately** — deferred to avoid a noisy gate before we understand baseline signal; flip recorded as a follow-up.

---

## Consequences

**Positive**
- The lifecycle-script worm vector is closed by default for all installs.
- CI installs are fully deterministic; action supply chain is SHA-pinned.
- Dependency updates arrive as reviewable, grouped PRs without auto-merge.
- Two additional advisory/provenance signals (OSV, audit signatures) in CI.

**Negative / trade-offs**
- Developers must run `npm run hooks:install` after clone (one-time, documented).
- OSV-Scanner / audit-signatures are advisory-only until flipped blocking.
- The secret-scanning sub-toggles could not be persisted via API on this repo (UI / org-move follow-up).

## Backlog (remaining supply-chain items, not in this sprint)

4. **Token hygiene** — scope/rotate CI tokens; least-privilege `GITHUB_TOKEN` permissions per job.
5. Revisit **auto-merge-as-ingestion-path** policy if/when a provenance-verified auto-merge (signed + Socket-clean) becomes viable.
- **Socket GitHub App** install (behavioral malicious-package detection).
- Centrally sanitize CR/LF in the shared logger to clear the 11 `js/log-injection` mediums (deferred in [ADR-060](ADR-060-code-scanning-gate.md)).

---

## Related

- [ADR-059: Dependency Vulnerability Remediation + Blocking CI Security Gate](ADR-059-dependency-security-gate.md).
- [ADR-060: Code Scanning Remediation + Blocking CI Code-Scanning Gate](ADR-060-code-scanning-gate.md) — shipped in the same sprint.
- [ADR-052: Security Hardening — OWASP Top 10 Baseline](ADR-052-security-hardening.md).
