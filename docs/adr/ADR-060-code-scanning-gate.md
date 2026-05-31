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
      run: |
        # Default setup is async — poll for an analysis on this SHA (bounded).
        analyses=0
        for i in $(seq 1 10); do
          analyses=$(gh api ".../code-scanning/analyses?ref=$REF&sha=$SHA&per_page=1" --jq 'length' || echo 0)
          [ "$analyses" -gt 0 ] && break
          sleep 30
        done
        if [ "$analyses" -eq 0 ]; then
          echo "::warning::No analysis for this SHA within timeout — passing (fail-open on MISSING analysis)."
          exit 0
        fi
        open=$(gh api ".../code-scanning/alerts?ref=$REF&state=open&per_page=100" --paginate \
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

---

## Related

- [ADR-059: Dependency Vulnerability Remediation + Blocking CI Security Gate](ADR-059-dependency-security-gate.md) — the dependency-audit sibling gate.
- [ADR-061: Supply-Chain & Secrets Hardening](ADR-061-supply-chain-and-secrets-hardening.md) — `ignore-scripts`, `npm ci`, OSV-Scanner, Dependabot, action SHA-pinning, secret-scanning toggles, shipped alongside this gate.
- [ADR-052: Security Hardening — OWASP Top 10 Baseline](ADR-052-security-hardening.md).
