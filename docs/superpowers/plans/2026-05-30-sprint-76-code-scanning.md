# Code Scanning Remediation + Supply-Chain Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Drive the 15 open CodeQL alerts to zero (fix the real ones, dismiss the false positives with written justifications), activate a blocking code-scanning CI gate (ADR-060), and fold in three supply-chain hardening quick wins (ADR-061) — shipping v10.5.0.

**Architecture:** No application code or schema changes of substance — two small frontend hardening edits, a new `code-scanning-gate` CI job that queries the GitHub code-scanning API (parallel to the ADR-059 dependency-audit job), `.npmrc` + workflow supply-chain changes, and two new ADRs with landing pages. The gate is a CI job (not a CodeQL workflow) because CodeQL runs via GitHub default setup.

**Tech Stack:** Node.js/Express/TypeScript, Next.js 14, PostgreSQL 15, Bull queue, GitHub Actions, `gh` CLI / code-scanning REST API.

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `docs/adr/ADR-060-code-scanning-gate.md` | ADR: blocking gate, CodeQL config upgrades (security-extended + remote_and_local), disposition discipline, SLA, poll design, PR-gate future option |
| `docs/adr/ADR-061-supply-chain-and-secrets-hardening.md` | ADR: ignore-scripts, npm ci, audit signatures, OSV-Scanner (+ Socket rec), dependabot.yml, secret-scanning toggles, install-hooks tradeoff |
| `apps/landing/src/data/docs/concepts/adr-060-code-scanning-gate.json` | Landing concept page for ADR-060 |
| `apps/landing/src/data/docs/concepts/adr-061-supply-chain-and-secrets-hardening.json` | Landing concept page for ADR-061 |
| `.github/dependabot.yml` | Review-gated, grouped security+version update PRs; NO auto-merge |
| `tests/regression/sprint-76-code-scanning-gate.test.ts` | Invariant test: gate job + osv step + dependabot.yml + ignore-scripts + encoding present |

### Existing files to modify
| File | Change |
|------|--------|
| `apps/frontend/src/lib/api.ts` | `encodeURIComponent` path params for raw-axios/unencoded SSRF cases (≥ line 803) |
| `apps/landing/src/components/sections/Movement.tsx` | `encodeURIComponent(email)` + trim in the `mailto:` href (clears the real XSS alert) |
| `.github/workflows/ci.yml` | Add `code-scanning-gate` job (fails on open critical/high); add `npm audit signatures` + OSV-Scanner steps |
| `.github/workflows/e2e-tests.yml` | `npm install` → `npm ci` (lines 26, 50) |
| `.npmrc` | Add `ignore-scripts=true` |
| repo settings (via `gh api`) | CodeQL `query_suite`→`security-extended`, `threat_model`→`remote_and_local`; secret-scanning validity + non-provider patterns ON |
| `package.json` (root) | `postinstall` no longer auto-installs hooks (or document explicit run); version 10.4.0 → 10.5.0 |
| `CLAUDE.md` | Note: hooks install explicitly via `npm run hooks:install` (ignore-scripts) |
| `docs/GITHUB_ACTIONS_SETUP.md` | Extend security section: code-scanning gate + supply-chain hardening + manual hooks note |
| `docs/adr/README.md` | Index ADR-060 + ADR-061 |
| `apps/landing/src/data/docs/nav.json` | Add ADR-060 + ADR-061 to "Architecture Decisions" |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **CodeQL is GitHub default setup — there is NO committed `codeql.yml`.** Do not create an advanced-setup workflow; it conflicts with default setup. The gate is a **CI job that queries the code-scanning alerts API**.
2. **Gate timing / fail decision:** default-setup analysis is async. Poll for an analysis on the pushed SHA with a bounded timeout. If analysis shows open critical/high → **fail**; if no analysis within timeout → warn + **pass** (fail-open on missing-analysis only, never on present-findings). Document in ADR-060.
3. **Dismissals use the API, not code.** `gh api -X PATCH repos/:owner/:repo/code-scanning/alerts/{n} -f state=dismissed -f dismissed_reason='false positive'|'won't fix' -f dismissed_comment='<justification from triage table>'`. Gate can't go green until 13 dismissals + 2 fixes are done.
4. **`encodeURIComponent` may not auto-clear the SSRF alerts** — CodeQL doesn't always treat path-encoding as a sanitizer. Harden anyway; expect to still dismiss with justification.
5. **`ignore-scripts=true` breaks auto hook-install.** Root `postinstall` runs `scripts/install-hooks.sh`. After the change a clean `npm ci` will NOT install hooks. Verify `npm run hooks:install` standalone + update docs.
6. **Upgrade the CodeQL suite FIRST (Task 1b), then re-scan, then triage.** `security-extended` + `remote_and_local` will surface *new* alerts. Triage the *extended* set, not the stale 15. Gate can't flip until the extended board is at zero. If the PATCH doesn't auto-trigger a scan, push a no-op commit / wait for next push.
7. **Can't flip the gate to blocking until the board is at zero.** Order: upgrade suite → re-scan → triage/fix/dismiss the full set → confirm 0 open critical/high → enable gate → negative-test it.
8. **OSV-Scanner is advisory-based, not behavioral** — broadens CVE coverage past `npm audit` but won't catch a brand-new malicious package. Commit it as a CI step; recommend the **Socket GitHub App** in ADR-061 as the behavioral complement (console install, not a committed gate).
9. **`dependabot.yml`: review-gated, grouped, NO auto-merge** (auto-merge is itself an ingestion path).
10. **ADR numbering:** 060 = code-scanning gate (+ CodeQL config upgrades), 061 = supply-chain & secrets hardening.
11. **Landing docs dir is `.gitignore`d** — `git add -f`. **nav.json revert bug** — grep-verify after generate-docs; re-apply if reverted.
12. **Version bump 10.4.0 → 10.5.0** (minor — new behavioral gate).
13. **`e2e-tests.yml` is the only remaining `npm install`** (lines 26, 50) → `npm ci`.
14. **Secret-scanning + CodeQL config are `gh api -X PATCH` settings**, not file changes — document them in the ADRs + GITHUB_ACTIONS_SETUP.md so they're reproducible.

### The 15 alerts (triage reference — baseline before the suite upgrade; expect MORE after Task 1b)

| # | Sev | Rule | Location | Disposition |
|---|-----|------|----------|-------------|
| 82,83,84,92,93,94,98 | crit | request-forgery | api.ts:341–360 | dismiss:false-positive (fixed host, path-only taint) |
| 86,97,119 | crit | request-forgery | api.ts:803,825,828 | harden (encode) + dismiss:false-positive |
| 88 | high | xss-through-dom | Movement.tsx:11 | **fix** (encodeURIComponent email) |
| 89,90 | high | xss-through-dom | communities/index.tsx:432-433 | dismiss:false-positive (relative href, React-escaped) |
| 117 | high | insecure-randomness | dibs-workflow.ts:22-23 | dismiss:won't-fix (sim engine, non-security) |
| 118 | high | insecure-randomness | api-client.ts:431 | dismiss:won't-fix (sim engine, non-security) |

---

## Task 1: Feature branch + baseline alert snapshot

**Files:** none (setup)

- [ ] **Create the branch off latest master**

```bash
git checkout master && git pull
git checkout -b feature/sprint-76-code-scanning
```

- [ ] **Snapshot the current open alerts** (confirms the 15 still match before triage)

```bash
gh api repos/:owner/:repo/code-scanning/alerts --paginate \
  -q '.[] | select(.state=="open") | "\(.number)\t\(.rule.security_severity_level // .rule.severity)\t\(.rule.id)\t\(.most_recent_instance.location.path):\(.most_recent_instance.location.start_line)"' \
  | sort -t$'\t' -k2
```

Expect 15 lines (10 critical request-forgery, 5 high). This is the *baseline* — the suite upgrade in Task 1b will likely add more.

---

## Task 1b: Upgrade scanner config + re-scan (do BEFORE triage)

**Files:** repo settings (via `gh api`) — no committed files

- [ ] **Bump CodeQL default-setup to the extended suite + local threat model**

```bash
gh api -X PATCH repos/:owner/:repo/code-scanning/default-setup \
  -f query_suite=extended -f threat_model=remote_and_local
# verify
gh api repos/:owner/:repo/code-scanning/default-setup --jq '{query_suite, threat_model, state}'
```

> If the API rejects `threat_model` for JS/TS, apply `query_suite=extended` alone and set the threat model in the UI (Settings → Code security → CodeQL → Edit). Record whichever path worked in ADR-060.

- [ ] **Enable secret-scanning validity checks + non-provider patterns**

```bash
gh api -X PATCH repos/:owner/:repo \
  -f 'security_and_analysis[secret_scanning_validity_checks][status]=enabled' \
  -f 'security_and_analysis[secret_scanning_non_provider_patterns][status]=enabled'
gh api repos/:owner/:repo --jq '.security_and_analysis'
```

- [ ] **Trigger + await a fresh CodeQL analysis on the extended suite**, then re-snapshot the FULL open set

```bash
# PATCH usually re-runs default setup; if not, push a no-op or wait for the branch push.
gh api repos/:owner/:repo/code-scanning/alerts --paginate \
  -q '.[] | select(.state=="open") | "\(.number)\t\(.rule.security_severity_level // .rule.severity)\t\(.rule.id)\t\(.most_recent_instance.location.path):\(.most_recent_instance.location.start_line)"' \
  | sort -t$'\t' -k2
```

- [ ] **Re-triage:** classify any NEW alerts the extended suite surfaced (fix-or-dismiss, same discipline). Extend the triage table in this plan with each new alert + disposition before touching Task 4. **The gate (Task 5) cannot flip until this full extended set is at zero.**

---

## Task 2: Fix the two real alerts (TDD-first)

**Files:**
- Create: `tests/unit/frontend/sprint-76-encoding.test.ts`
- Modify: `apps/frontend/src/lib/api.ts`, `apps/landing/src/components/sections/Movement.tsx`

- [ ] **Write the failing unit tests first** — assert exact encoded output

```ts
// mailto: a "+" / space / "#" in email must be percent-encoded
expect(buildMailto('a b+c#d@x.com')).toBe(
  'mailto:contact@karmyq.org?subject=Karmyq%20updates&body=...a%20b%2Bc%23d%40x.com'
);
// path param with a slash/space must be encoded, not split the path
expect(validateInvitationUrl('AB/CD 12')).toContain('/invitations/validate/AB%2FCD%2012');
```

Extract the URL/mailto construction into a tiny pure helper if needed so it's unit-testable (no network). Keep it minimal — don't refactor the whole client.

- [ ] **Implement: encode the `mailto` email** in `Movement.tsx`

```ts
const handleSubscribe = () => {
  const addr = email.trim();
  if (!addr) return;
  const body = `Please add me to the Karmyq updates list. My email: ${addr}`;
  window.location.href =
    `mailto:contact@karmyq.org?subject=${encodeURIComponent('Karmyq updates')}&body=${encodeURIComponent(body)}`;
};
```

- [ ] **Implement: encode path params** for the raw-`axios`/unencoded SSRF cases in `api.ts` (at minimum `validateInvitationCode` line 803)

```ts
validateInvitationCode: (invitationCode: string) =>
  axios.get(`${SOCIAL_GRAPH_API_URL}/invitations/validate/${encodeURIComponent(invitationCode)}`),
```

Apply `encodeURIComponent` to interpolated path segments in the other flagged raw cases (825, 828) where the segment isn't already encoded. (`getTrustGraph`/`getTrustGraphAggregate` already encode `center`.)

- [ ] **Verify the new tests pass**

```bash
npm run test:unit -- sprint-76-encoding
```

---

## Task 3: `/simplify` pass on the code edits

**Files:** the Task 2 diff

- [ ] **Run `/simplify` on the Task 2 changes** — ensure the encoding helpers reuse existing utilities and don't over-abstract. Resolve findings.

---

## Task 4: Dismiss the false-positive / won't-fix alerts (with justifications)

> Baseline = 13 dismissals (10 SSRF + 2 XSS + 2 randomness, minus the 1 fixed). Add any extra dismissals the Task 1b extended-suite re-scan surfaced.

**Files:** none (code-scanning API)

- [ ] **Dismiss the 10 SSRF false positives** — fixed host, path-only taint

```bash
for n in 82 83 84 92 93 94 98 86 97 119; do
  gh api -X PATCH repos/:owner/:repo/code-scanning/alerts/$n \
    -f state=dismissed -f dismissed_reason="false positive" \
    -f dismissed_comment="Path segment interpolated into a fixed-host axios client (baseURL = NEXT_PUBLIC_* env constant). Host is never attacker-controlled; no SSRF/open-redirect possible. Path params hardened with encodeURIComponent as defense-in-depth (Sprint 76, ADR-060)."
done
```

- [ ] **Dismiss the 2 XSS false positives** (alerts 89, 90) — relative href + React-escaped, JWT-sourced id

```bash
for n in 89 90; do
  gh api -X PATCH repos/:owner/:repo/code-scanning/alerts/$n \
    -f state=dismissed -f dismissed_reason="false positive" \
    -f dismissed_comment="Relative href prefixed with /communities/ (cannot form a javascript: scheme); value is a JWT-sourced community id rendered as React-escaped child. Not exploitable (Sprint 76, ADR-060)."
done
```

- [ ] **Dismiss the 2 insecure-randomness alerts** (117, 118) — non-security sim engine

```bash
for n in 117 118; do
  gh api -X PATCH repos/:owner/:repo/code-scanning/alerts/$n \
    -f state=dismissed -f dismissed_reason="won't fix" \
    -f dismissed_comment="Math.random() selects synthetic entities in the simulation engine (demo data generation). Not a token/nonce/secret and not on any auth or crypto path (Sprint 76, ADR-060)."
done
```

- [ ] **Verify the board is at zero open critical/high**

```bash
gh api repos/:owner/:repo/code-scanning/alerts --paginate \
  -q '[.[] | select(.state=="open" and (.rule.security_severity_level=="critical" or .rule.security_severity_level=="high"))] | length'
# Expect: 0   (alert 88 is fixed by code in Task 2 once CodeQL re-scans the merged commit)
```

> Note: alert 88 (Movement.tsx) clears on the next CodeQL scan of the fixed code, not via dismissal. If it lingers as open after merge + re-scan, investigate — do not dismiss a "fixed" alert.

---

## Task 5: Add the blocking code-scanning gate to CI (ADR-060)

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Add a `code-scanning-gate` job** parallel to the existing `security:` job. It polls the code-scanning API for an analysis on the pushed SHA, then fails on open critical/high.

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
          # Poll for a code-scanning analysis on this SHA (default setup is async)
          for i in $(seq 1 10); do
            analyses=$(gh api "repos/${{ github.repository }}/code-scanning/analyses?ref=${{ github.ref }}&sha=${{ github.sha }}" --jq 'length' 2>/dev/null || echo 0)
            [ "$analyses" -gt 0 ] && break
            echo "No analysis yet for ${{ github.sha }} (attempt $i) — waiting…"; sleep 30
          done
          if [ "${analyses:-0}" -eq 0 ]; then
            echo "::warning::No code-scanning analysis available for this SHA within timeout — passing (fail-open on missing analysis, see ADR-060)."
            exit 0
          fi
          open=$(gh api "repos/${{ github.repository }}/code-scanning/alerts?ref=${{ github.ref }}&state=open&severity=critical,high" --paginate --jq 'length')
          if [ "$open" -gt 0 ]; then
            echo "::error::$open open critical/high code-scanning alert(s) — blocking (ADR-060)."
            gh api "repos/${{ github.repository }}/code-scanning/alerts?ref=${{ github.ref }}&state=open&severity=critical,high" \
              --jq '.[] | "  - #\(.number) \(.rule.id) \(.most_recent_instance.location.path):\(.most_recent_instance.location.start_line)"'
            exit 1
          fi
          echo "Code-scanning gate clean: 0 open critical/high (ADR-060)."
```

> Validate the exact `severity` query-param support against the API; if the endpoint doesn't filter by severity, fetch open alerts and filter `security_severity_level in (critical,high)` in `jq`. Confirm the runner has `gh` (ubuntu-latest does).

- [ ] **Verify the workflow parses**

```bash
npx --yes @action-validator/cli .github/workflows/ci.yml || yamllint .github/workflows/ci.yml
```

---

## Task 6: Supply-chain & secrets hardening (ADR-061)

**Files:**
- Create: `.github/dependabot.yml`
- Modify: `.npmrc`, `.github/workflows/e2e-tests.yml`, `.github/workflows/ci.yml`, `package.json`, `CLAUDE.md`

- [ ] **`.npmrc`: add `ignore-scripts=true`**

- [ ] **Move hook install off `postinstall`** — root `package.json` postinstall no longer silently runs install-hooks (it won't run anyway with ignore-scripts). Keep `hooks:install` script; update CLAUDE.md to instruct `npm run hooks:install` after clone.

- [ ] **Verify hooks still install explicitly** (critical — note #5)

```bash
npm run hooks:install && ls -la .git/hooks/pre-push .git/hooks/pre-commit
```

- [ ] **`e2e-tests.yml`: `npm install` → `npm ci`** at lines 26 and 50

```bash
grep -n 'npm install' .github/workflows/e2e-tests.yml   # expect: no matches after edit
```

- [ ] **Add `npm audit signatures` step to `ci.yml`** (in the `security:` job, after `npm ci`; non-blocking informational first, then decide blocking). Document the chosen blocking-ness in ADR-061.

- [ ] **Add an OSV-Scanner step to `ci.yml`** — broader advisory DB than `npm audit` (note #8). Use the official action, non-blocking first:

```yaml
      - name: OSV-Scanner (supply-chain advisory scan)
        uses: google/osv-scanner-action/osv-scanner-action@v2  # pin to a released SHA/tag
        with:
          scan-args: |-
            --lockfile=package-lock.json
        continue-on-error: true   # informational first; ADR-061 records when this flips blocking
```

- [ ] **Create `.github/dependabot.yml`** — review-gated, **grouped**, **no auto-merge** (note #9):

```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: "/"
    schedule: { interval: weekly }
    open-pull-requests-limit: 10
    groups:
      production-deps: { dependency-type: production }
      dev-deps: { dependency-type: development }
  - package-ecosystem: github-actions
    directory: "/"
    schedule: { interval: weekly }
```

- [ ] **Confirm a clean install still works end-to-end with scripts ignored**

```bash
rm -rf node_modules && npm ci && npm run build
```

> Note: CodeQL `security-extended`/`remote_and_local` and the secret-scanning toggles were applied in **Task 1b** (settings, not files). This task is the file-committed half of ADR-061.

---

## Task 7: `/simplify` pass on CI + config diff

**Files:** the Task 5–6 diff

- [ ] **Run `/simplify`** on the workflow/config changes — remove duplication between the two security jobs, confirm the gate script is as small as it can be. Resolve findings.

---

## Task 8: ADR-060 + ADR-061 + landing pages + docs

**Files:**
- Create: `docs/adr/ADR-060-code-scanning-gate.md`, `docs/adr/ADR-061-supply-chain-and-secrets-hardening.md`
- Create: `apps/landing/src/data/docs/concepts/adr-060-code-scanning-gate.json`, `apps/landing/src/data/docs/concepts/adr-061-supply-chain-and-secrets-hardening.json`
- Modify: `docs/adr/README.md`, `apps/landing/src/data/docs/nav.json`, `docs/GITHUB_ACTIONS_SETUP.md`

- [ ] **Write ADR-060** (status: Implemented) — gate design + poll/fail-open-on-missing-analysis decision; **CodeQL config upgrades** (`security-extended` + `remote_and_local`, with the exact `gh api` commands used); disposition discipline; SLA (high/crit ≤1wk, any ≤2wk); `git push --no-verify` escape hatch; **PR-based native gate recorded as a future option** (and why direct-push poll-gate was chosen for now).
- [ ] **Write ADR-061** (status: Implemented) — ignore-scripts + install-hooks tradeoff; npm ci everywhere; npm audit signatures; **OSV-Scanner** (+ Socket App recommendation, note #8); **dependabot.yml** (grouped, review-gated, no auto-merge); **secret-scanning validity + non-provider toggles**; relation to ADR-059/060; remaining backlog items 4–5 (token hygiene; auto-merge-as-ingestion-path).
- [ ] **Index both in `docs/adr/README.md`**
- [ ] **Create both landing concept JSONs** (mirror `adr-059-dependency-security-gate.json` shape: `slug`, `number`, `title`, `status`, `description`, `content`, `filename`)
- [ ] **Add both to `nav.json` "Architecture Decisions"**; if a `generate-docs` step exists, run it from `apps/landing/` then grep-verify (nav revert bug)
- [ ] **Extend `docs/GITHUB_ACTIONS_SETUP.md`** security section: code-scanning gate, CodeQL config upgrades, OSV-Scanner, dependabot.yml, secret-scanning toggles, manual `npm run hooks:install` note
- [ ] **Verify landing add + nav integrity**

```bash
git add -f apps/landing/src/data/docs/concepts/adr-060-code-scanning-gate.json apps/landing/src/data/docs/concepts/adr-061-supply-chain-and-secrets-hardening.json
grep -c 'adr-060\|adr-061' apps/landing/src/data/docs/nav.json   # expect >=2
```

---

## Task 9: Regression test + version bump + feedback loop

**Files:**
- Create: `tests/regression/sprint-76-code-scanning-gate.test.ts`
- Modify: `package.json` (version)

- [ ] **Write the invariant regression test** — asserts the gate + hardening can't silently regress

```ts
// .github/workflows/ci.yml contains a code-scanning-gate job + OSV-Scanner
expect(ci).toMatch(/code-scanning-gate/);
expect(ci).toMatch(/osv-scanner/i);
// .npmrc enforces ignore-scripts
expect(npmrc).toMatch(/^ignore-scripts=true/m);
// dependabot config exists and does NOT enable auto-merge
expect(fs.existsSync('.github/dependabot.yml')).toBe(true);
// e2e workflow uses npm ci, not npm install
expect(e2e).not.toMatch(/npm install/);
// Movement.tsx encodes the mailto email
expect(movement).toMatch(/encodeURIComponent\(\s*(email|body|addr)/);
```

> Config-only changes (CodeQL suite, secret-scanning toggles) live in repo settings, not files — they can't be asserted in a repo test. ADR-060/061 are their durable record; the gate job is the runtime enforcement.

- [ ] **Bump version** 10.4.0 → 10.5.0 in root `package.json`
- [ ] **Run the feedback loop check**

```bash
npm run test:regression -- sprint-76-code-scanning-gate
npm run feedback:check
```

---

## Task 10: SDLC quality gates (mandatory)

**Files:** whole branch diff

- [ ] **`/simplify`** — final pass on the entire branch diff (reuse, altitude). Resolve findings.

```bash
# verify: no obvious duplication between the two CI security jobs; encoding helpers reuse existing utils
```

- [ ] **`/code-review`** — on the branch diff; resolve correctness/logic findings (esp. the gate script's severity filter + fail-open logic).

```bash
# verify: review run, findings triaged/resolved
```

- [ ] **`/security-review`** — on the branch diff; confirm the dismissals are sound and the gate logic can't be trivially bypassed. Justify any dismissed findings in writing.

```bash
# verify: security-review run, real findings resolved
```

- [ ] **Standing CI gates still pass**

```bash
npm audit --package-lock-only --audit-level=high   # ADR-059 gate (must stay clean)
```

---

## Task 11: Final type check + pre-push verification

**Files:** none

- [ ] **Type-check the touched apps**

```bash
cd apps/frontend && npx tsc --noEmit; cd ../landing && npx tsc --noEmit; cd ../..
```

- [ ] **Full pre-push suite**

```bash
npm test                 # unit + regression — MUST pass
npm run test:tdd         # informational (pre-existing failures listed in handoff are OK)
npm run feedback:check   # docs complete
```

- [ ] **Confirm code-scanning board is still zero open critical/high** (Task 4 verify command). The gate's negative test: temporarily confirm the gate script exits 1 when fed a non-empty alert set (dry-run locally or reason through it), then ensure real state is clean.

---

## Task 12: Merge + Deploy

**Files:** none — use the `/deploy` skill.

- [ ] **Merge to master + push**

```bash
git checkout master && git merge --no-ff feature/sprint-76-code-scanning
git push origin master
```

- [ ] **Monitor GitHub Actions** — confirm the new `code-scanning-gate` job runs and passes (board is clean), the dependency `security:` job stays green, `npm audit signatures` behaves as configured, and e2e `npm ci` works. CI/CD auto-deploys to demo on green.
- [ ] **Post-deploy:** verify the gate would block — confirm via the Actions log that `code-scanning-gate` evaluated the SHA and reported "0 open critical/high". Update the handoff (Sprint 76 complete; Sprint 77 next).
