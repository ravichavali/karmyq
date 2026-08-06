# ADR-060: Code Scanning Remediation + Blocking CI Code-Scanning Gate

**Status**: Implemented
**Date**: 2026-05-30
**Sprint**: 76

---

## Context

[ADR-059](ADR-059-dependency-security-gate.md) closed the *dependency* half of our security posture with a blocking `npm audit` gate. The *code* half — CodeQL static analysis — was running but **advisory only**: alerts accumulated on the Security tab with nothing blocking a merge. Sprint 76's mandate was to mirror ADR-059 for code scanning: drive the board to **zero open critical/high**, then make a regression impossible by adding a blocking gate.

### Two starting problems

1. **The scanner was under-powered.** CodeQL ran via GitHub **default setup** with the conservative `query_suite=default` + `threat_model=remote`. That combination gives partial coverage — it misses whole rule classes and treats only network-remote inputs as taint sources. For a codebase about to go public, "default" gives an unrealistically clean board.
2. **CodeQL is default setup — there is no committed `codeql.yml`.** Default setup is configured through repo settings / the API, not a workflow file. Adding an advanced-setup workflow would *conflict* with default setup. So the gate cannot be "a CodeQL step that fails" — it has to be a **separate CI job that queries the code-scanning alerts API** after the async analysis lands.

### What the suite upgrade surfaced

Bumping default setup to **`security-extended` + `remote_and_local`** re-scanned the tree and surfaced **386 open critical/high** alerts (vs. a 15-alert baseline on the old config) plus 14 medium. This was expected — `remote_and_local` adds local/filesystem/path inputs as taint sources, and `security-extended` adds deeper rule classes. The decision (taken with the maintainer, given imminent public release) was to **keep the aggressive config and triage all 386 to zero** rather than dial the threat model back.

---

## Decision

### 1. Upgrade the CodeQL default-setup configuration

Applied via the API (settings, not a committed file — recorded here for reproducibility):

```bash
gh api -X PATCH repos/:owner/:repo/code-scanning/default-setup \
  -f query_suite=extended -f threat_model=remote_and_local
# verify
gh api repos/:owner/:repo/code-scanning/default-setup --jq '{query_suite, threat_model, state}'
# => { "query_suite": "extended", "threat_model": "remote_and_local", "state": "configured" }
```

The PATCH triggers a fresh CodeQL Setup run; the analysis follows asynchronously.

### 2. Remediation discipline: fix real, dismiss with written justification

Every one of the 386 critical/high (and the gate-relevant mediums) was triaged by **reading the source**, never blanket-dismissed. Dispositions:

| Rule | Count | Disposition | Justification |
|------|------:|-------------|---------------|
| `js/request-forgery` | 350 crit | dismiss: false positive / used in tests | Path segment interpolated into a **fixed-host axios client** (`baseURL` = build-time `NEXT_PUBLIC_*` env constant). Host is never attacker-controlled → no SSRF/open-redirect; only the path is tainted. Raw-axios path params hardened with `encodeURIComponent` as defense-in-depth. Test-file occurrences dismissed "used in tests". |
| `js/user-controlled-bypass` | 10 high | dismiss: false positive | JWT bearer-token auth: the token is **necessarily** client-supplied and `jwt.verify(token, JWT_SECRET)` (cryptographic signature check) **is** the security control. A user-controlled token reaching `verify()` is the design, not a bypass. |
| `js/sql-injection` | 13 high | dismiss: won't fix | All in the **archived** `scripts/archive/seeding/` dev script — string-built bulk `INSERT` over synthetic, program-generated values; never untrusted input, never run in production. |
| `js/remote-property-injection` | 4 high | dismiss: false positive / won't fix / used in tests | Runtime cases (`requests.ts`, `preferences.ts`) use **server-computed / DB-enum** values (`sourceTier`, `interest_type`) as keys in plain grouping `Record`s — not attacker-controllable. Others are dev tooling / test code. |
| `js/xss-through-dom` | 3 high | **1 fixed in code**, 2 dismiss: false positive | `Movement.tsx` mailto **fixed** (encode email). `communities/index.tsx` 89/90: JWT-sourced community id in a **relative** href (`/communities/…`, cannot form `javascript:`) + React-escaped child. |
| `js/path-injection` | 2 high | dismiss: won't fix | Dev tooling (`scripts/update-memory-state.js`) writing to fixed constant paths, single-user local execution. |
| `js/file-system-race` | 2 high | dismiss: won't fix | Dev tooling read-modify-write of repo files, single-user local execution; the TOCTOU window is not a security boundary. |
| `js/insecure-randomness` | 2 high | dismiss: won't fix | `Math.random()` selects synthetic entities in the simulation engine; not a token/nonce/secret, not on any auth/crypto path. |
| `actions/unpinned-tag` | 3 med | **fixed** | Third-party GitHub Actions (`docker/*`) pinned to full commit SHA (see [ADR-061](ADR-061-supply-chain-and-secrets-hardening.md)). |
| `js/log-injection` | 11 med | dismiss: won't fix (backlog) | User-influenced values reach the structured logger without CR/LF stripping; logs are internal, no boundary crossed. Backlog: centrally sanitize in the shared logger. |

Dismissals were applied via the API (not code) with the per-class justification as the `dismissed_comment`:

```bash
gh api -X PATCH repos/:owner/:repo/code-scanning/alerts/{n} \
  -f state=dismissed -f dismissed_reason='false positive'|'won't fix'|'used in tests' \
  -f dismissed_comment='<justification>'
```

> **Fixed ≠ dismissed.** Alert #88 (Movement.tsx) and the 3 unpinned-tag alerts are *fixed in code* and clear on the next CodeQL scan of the merged commit — they are **not** dismissed. Dismissing a fixed alert would hide a future regression.

### 3. The blocking gate (`code-scanning-gate` CI job)

A new job in `.github/workflows/ci.yml`, parallel to ADR-059's `security:` job and added to `build-images.needs` so a failure blocks the build + deploy:

```yaml
code-scanning-gate:
  name: Code Scanning Gate (ADR-060)
  runs-on: ubuntu-latest
  permissions:
    security-events: read
  steps:
    - name: Fail on open critical/high CodeQL alerts
      env:
        GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        # See §6 — resolving the scan target per event type is load-bearing.
        SCAN_REF: ${{ github.event_name == 'pull_request' && format('refs/pull/{0}/head', github.event.number) || github.ref }}
        SCAN_SHA: ${{ github.event_name == 'pull_request' && github.event.pull_request.head.sha || github.sha }}
      run: |
        # Default setup is async — poll for an analysis on this SHA (bounded).
        analyses=0
        for i in $(seq 1 10); do
          analyses=$(gh api ".../code-scanning/analyses?ref=$SCAN_REF&sha=$SCAN_SHA&per_page=1" --jq 'length' || echo 0)
          [ "$analyses" -gt 0 ] && break
          sleep 30
        done
        if [ "$analyses" -eq 0 ]; then
          echo "::warning::No analysis for this SHA within timeout — passing (fail-open on MISSING analysis)."
          exit 0
        fi
        open=$(gh api ".../code-scanning/alerts?ref=$SCAN_REF&state=open&per_page=100" --paginate \
          --jq '.[] | select(.rule.security_severity_level=="critical" or .rule.security_severity_level=="high") | .number' | wc -l)
        [ "$open" -gt 0 ] && { echo "::error::$open open critical/high — blocking"; exit 1; }
```

**Design decisions:**

- **Fail-open on *missing analysis* only, never on present findings.** Default-setup analysis is asynchronous; the job polls up to 10×30s for an analysis on the pushed SHA. If none lands in the window, it **warns and passes** (a missing analysis is an infrastructure race, not a security signal). If an analysis exists and shows open critical/high → it **fails**. The asymmetry is deliberate: never let a transient timing gap silently block, never let a real finding silently pass.
- **Severity filtered in `jq`, not the API query param.** The alerts endpoint's `severity` filter is unreliable across rule types; we fetch open alerts and filter on `rule.security_severity_level in (critical, high)` locally.
- **Gate scope = critical + high.** Mediums are tracked (SLA below) but do not block, matching ADR-059's `--audit-level=high`.

### 4. SLA

- No **high/critical** code-scanning alert (or dependency vuln) open **> 1 week**.
- No finding of **any** severity open **> 2 weeks**.
- New genuine findings are fixed; new false positives are dismissed **with a written justification** — an undismissed, untriaged alert is itself an SLA breach.

### 5. Escape hatch

`git push --no-verify` skips local hooks; the **CI gate cannot be bypassed** from a push. A genuinely needed exception is made by triaging/dismissing the specific alert with justification (which is auditable), not by disabling the job.

### 6. Sprint 122 correction — the gate was inert on every pull request (2026-08-05)

**The gate had never blocked a pull request.** From its introduction in Sprint 76 until this fix, the poll queried `ref=${{ github.ref }}&sha=${{ github.sha }}`. On a `pull_request` event those resolve to `refs/pull/N/merge` and the ephemeral **merge commit**, while CodeQL default setup publishes its analysis to `refs/pull/N/**head**` and the head sha. The query could therefore never match: 10 attempts → 0 analyses → the fail-open branch → `exit 0`. The alerts query at the next line carried the same defect, so even past the fail-open the critical/high count was a vacuous `0`.

Verified against the live API on merged PR #194 (head `9bce1cfb`, merge commit `7bfa3471`):

| Query | Analyses returned |
|---|---|
| `ref=refs/pull/194/merge&sha=7bfa3471…` (what the gate ran) | **0** |
| `ref=refs/pull/194/head&sha=9bce1cfb…` (the fix) | **1** |

Enumerating all published analyses confirms the rule: they appear only under `refs/heads/master` and `refs/pull/N/head` — never a `/merge` ref.

**Fix.** Resolve the scan target explicitly per event type (`SCAN_REF` / `SCAN_SHA` above), applied to **both** the analyses poll and the alerts query. On `push` events the behaviour is unchanged — `github.ref`/`github.sha` were always correct there, which is why the gate did work on master and produced the misleading impression that it worked everywhere.

**Fail-open, revisited deliberately.** Fail-open on a *genuinely missing* analysis is still correct — default setup is asynchronous and a rescan lag is an infrastructure race, not a security signal. Fail-open on a query that can **never** match is not; it is an unconditional pass wearing a gate's clothing. The distinction is now the whole point of the design, so the asymmetry stands as written in §3, with the scan target corrected beneath it.

### 6b. Two further defects, found by review of the fix itself (PR #195)

The corrected gate went green on PR #195 and that was reported as "green for the right reason". It was not. Review found two ways the gate still under-asserted:

**Partial completion.** The poll broke out on the *first* analysis to appear. CodeQL default setup publishes one analysis per category, and on #195 at sha `27e2d474` the timing was:

| Analysis | Published |
|---|---|
| `/language:actions` | 04:00:04Z |
| **gate reported clean** | **04:00:10Z** |
| `/language:javascript-typescript` | 04:01:10Z |

The gate passed **66 seconds before the JavaScript analysis existed** — a late JS high/critical would have escaped. Readiness now requires **every** expected category. The expected set is derived at run time from `code-scanning/default-setup` (`languages`, normalising `javascript`/`typescript` → the single published category `javascript-typescript`), not from a hand-maintained list — a shadow map here would drift and silently re-narrow the gate, which is the failure mode §6 exists to document.

**API errors read as "no findings".** `gh api … || echo 0` mapped authentication, rate-limit, network and 5xx failures onto the same value as a valid empty result, and the alerts query treated an error as an empty alert list. That is strictly broader than the stated policy. All three queries (`default-setup`, `analyses`, `alerts`) now distinguish an error from an empty response and **exit 1** rather than fail open: a failed query means the security state could not be established at all, which is not the same as establishing that it is clean.

Fork PRs without `security-events: read` will therefore fail this job rather than silently pass. That is the intended reading of the policy; revisit it if this repo starts taking fork contributions.

**Test coverage for both** is in the same regression file, including a stub that honours the workflow's own jq severity predicate rather than reimplementing it — so narrowing that predicate in `ci.yml` turns the seeded-high case red instead of quietly passing.

**Locked by test.** `tests/regression/sprint-122-adr-060-code-scanning-gate.test.ts` asserts both halves: that the workflow resolves the head ref/sha (and never reintroduces the raw `github.ref`/`github.sha` in either query), and — by extracting the shipped `run:` body and executing it against a stubbed `gh` — that the gate **exits 1 on a seeded critical or high finding** and 0 otherwise. A green gate run cannot distinguish a working gate from an inert one, which is precisely how this survived from Sprint 76 to Sprint 122; the test is written so that the failing direction is the one under proof.

---

## Alternatives Considered

1. **PR-based native severity gate** (GitHub's "code scanning results" required check with a severity threshold on PRs). Stronger and zero custom script — but it gates **pull requests**, and Karmyq currently deploys via **direct push to master** (see deploy workflow). Adopting it would mean reworking the branching model. **Recorded as the preferred future option**; deferred this sprint. The custom poll-gate fits the current direct-push flow.
2. **Dial the threat model back to `remote`** to shrink the board from 386 to a smaller, mostly-remote-exploitable set. Rejected for this sprint: with public release imminent, maximum coverage + full triage was preferred over a quieter board.
3. **Advanced-setup `codeql.yml` workflow.** Rejected — conflicts with default setup, and default setup already gives autobuild + managed query packs.

---

## Consequences

**Positive**
- Code-scanning debt can no longer silently accumulate; the board is at **0 open critical/high** and stays there or CI goes red.
- Coverage is now `security-extended` + `remote_and_local` — substantially deeper than the prior default.
- Every dismissal carries an auditable written justification.

**Negative / trade-offs**
- The aggressive config produces more false positives (350 fixed-host request-forgery), which is ongoing triage cost. Mitigated by the per-class justifications (future occurrences of the same pattern are quick to dismiss by reference).
- The poll-gate fails open on a missing analysis — a (narrow) window where a push could deploy before analysis completes. Accepted, and documented; the next push re-evaluates.
- **A gate observed only in its passing state is unfalsifiable.** This one shipped inert on pull requests for ~46 sprints while reporting green every time. The general lesson, now applied to new gates repo-wide: a check must be demonstrated **failing** on a seeded violation before it is trusted, and that demonstration belongs in a test rather than in a one-off manual run.

---

## Related

- [ADR-059: Dependency Vulnerability Remediation + Blocking CI Security Gate](ADR-059-dependency-security-gate.md) — the dependency-audit sibling gate.
- [ADR-061: Supply-Chain & Secrets Hardening](ADR-061-supply-chain-and-secrets-hardening.md) — `ignore-scripts`, `npm ci`, OSV-Scanner, Dependabot, action SHA-pinning, secret-scanning toggles, shipped alongside this gate.
- [ADR-052: Security Hardening — OWASP Top 10 Baseline](ADR-052-security-hardening.md).
