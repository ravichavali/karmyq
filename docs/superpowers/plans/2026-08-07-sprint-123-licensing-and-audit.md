# Sprint 123: Licensing Decision + Record the Audit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Publish AGPL-3.0-or-later, reconcile every contradictory license claim in the repository,
record the manifesto audit as ADR-092 and the `federation` fossil as ADR-093, and add a regression
gate that fails when any two license sources disagree.

**Architecture:** No service, endpoint, schema or event changes. The new runtime artifact is a
repo-wide regression gate in `tests/regression/` that reads six prose claim sites and eighteen
workspace manifests, normalizes each to a license family, and fails on disagreement, on absence, and
on any unallowlisted new claim.

**Tech Stack:** Node.js 24/Express 5/TypeScript, Next.js 15, PostgreSQL 15, Bull queue, Jest 30.

**Spec:** [`2026-08-07-sprint-123-licensing-and-audit-design.md`](../specs/2026-08-07-sprint-123-licensing-and-audit-design.md)
**Arc:** [`2026-08-06-sprint-123-126-manifesto-alignment-arc-design.md`](../specs/2026-08-06-sprint-123-126-manifesto-alignment-arc-design.md) §4 S123

---

## File Map

### New files to create

| File | Responsibility |
|------|---------------|
| `LICENSE` | Verbatim GNU AGPL v3 text + `Copyright (C) 2025-2026 Ravi Chavali` |
| `.mailmap` | Collapse 3 maintainer identities and 2 Pallavi identities |
| `tests/regression/sprint-123-license-consistency-gate.test.ts` | The gate |
| `docs/adr/ADR-092-agpl-licensing-and-manifesto-audit.md` | Licensing decision + the audit |
| `docs/adr/ADR-093-federation-schema-reserved.md` | `federation` is reserved, not deleted |
| `docs/concepts/open-source-and-agpl.md` | User-facing: what AGPL means if you fork or self-host |

### Existing files to modify

| File | Change |
|------|--------|
| `package.json` + 17 other manifests | Add `"license": "AGPL-3.0-or-later"` |
| `README.md:4` | Badge MIT → AGPL-3.0-or-later; link now resolves |
| `README.md:164` | License section MIT → AGPL-3.0-or-later |
| `CONTRIBUTING.md:52` | Contributor agreement MIT → AGPL-3.0-or-later |
| `apps/mobile/README.md:363` | Align wording to `AGPL-3.0-or-later`; link now resolves |
| `apps/landing/src/components/Footer.tsx:26` | Link "AGPLv3" to the repository `LICENSE` |
| `apps/landing/src/lib/landingContent.ts:278` | Align token if the normalizer needs it unambiguous |
| `scripts/generate-docs.ts` | `ADR_GROUPS` (+2 ADR slugs), `CONCEPT_ORDER` and `whyKarmyq` (+1 concept slug) |
| `docs/adr/README.md` | Index entries for ADR-092, ADR-093 |
| `CLAUDE.md:175` | "13 schemas" → 12 live + 1 reserved |
| `AGENTS.md` | Sync schema count if repeated there |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **The AGPL text is copied verbatim from a canonical source, never hand-typed or reconstructed
   from memory.** Fetch `https://www.gnu.org/licenses/agpl-3.0.txt` with `node -e` + `fetch`
   (`curl` is unreliable on this host — spurious status 000) and verify before committing: the file
   must contain `GNU AFFERO GENERAL PUBLIC LICENSE`, `Version 3, 19 November 2007`, the closing
   `<https://www.gnu.org/licenses/>`, and be ~660 lines. **A license file with typos is a real
   defect, not a cosmetic one.** If the fetch fails, stop and ask — do not approximate.
2. **The gate goes in `tests/regression/`, not `tests/tdd/`.** Root `tests/tdd/` never
   auto-promotes (`scripts/promote-tdd-tests.js` walks only `services/*` and `apps/*`), so a gate
   left there blocks nothing. See `tests/CLAUDE.md`.
3. **A null extraction must fail the gate, not skip it.** The recurring defect in this repo is gates
   that assert weaker than they claim — presence instead of blocking, count instead of identity.
   If a site's extractor returns `null`, that is a red test.
4. **Prove each extractor can fail, not just one.** Table-driven MIT-flip per source, plus one real
   on-disk flip of `README.md:4` with both red and green outputs pasted into the PR.
5. **Run the gate directly, never through Turbo:**
   `cd tests && npx jest regression/sprint-123-license-consistency-gate.test.ts`. Turbo's cache
   misses cross-workspace test inputs — a `tests/regression/*` file reading `apps/landing` and
   `apps/mobile` will cache a stale pass while CI fails.
6. **`nav.json` is generated and hand-edits silently revert.** The source is `scripts/generate-docs.ts`.
   ADR-092/093 go in `ADR_GROUPS` ("— Infrastructure —", line ~520); the new concept page goes in
   **both** `CONCEPT_ORDER` (line ~245) and the `whyKarmyq` array (line 578). All 89 ADRs are
   currently curated there, and `doc-context-drift-gate.test.ts` fails on any concept page missing
   from nav — so skipping this step breaks an existing gate.
7. **`npm test` regenerates the landing docs.** The prebuild runs `generate-docs`, which rewrites
   `apps/landing/src/data/docs/`. Expect timestamp/HEAD-sha churn; commit the intended ADR/concept
   additions and revert the incidental churn.
8. **The manifest list is discovered, not hand-written.** Globbing `services/*`, `apps/*`,
   `packages/*` plus the four root manifests means a new workspace cannot appear unlicensed and pass.
   A hand-written shadow list is exactly the false-green pattern CLAUDE.md Discipline 5 forbids.
9. **`CONTRIBUTING.md:52` and `apps/mobile/README.md:363` are not in the arc design.** They were
   found during planning. `CONTRIBUTING.md` is the live contributor agreement and is the most
   legally consequential MIT statement in the repository — it is not optional scope.
10. **The shields.io badge escapes hyphens.** `AGPL-3.0-or-later` renders as
    `license-AGPL--3.0--or--later-blue` in the badge URL. The gate must un-escape before comparing,
    and the rendered badge should be eyeballed once.
11. **`git add` CLAUDE.md carefully on Windows** — it is tracked lowercase as `claude.md`.
12. **No docs-only push to master.** Everything lands in the one PR; a post-merge docs push triggers
    a second deploy and 502s the demo.

---

## Task 1: Branch + `.mailmap` + provenance baseline

**Files:**
- Create: `.mailmap`

- [ ] **Branch off `origin/master`, not local master**

```bash
git fetch origin
git checkout -b feature/sprint-123-licensing-and-audit origin/master
```

- [ ] **Re-measure provenance at HEAD before writing any of it into an ADR** (Discipline 5 —
      the ADR's commit table must be read out of git, not copied from the spec)

```bash
git log --all --format='%aN <%aE>' | sort | uniq -c | sort -rn
git log --reverse --format='%h %aN <%aE> %ad' --date=short | head -1
```

- [ ] **Create `.mailmap`** collapsing the maintainer's three identities and Pallavi's two

```
Ravi Chavali <ravichavali@gmail.com> <ravichavali@users.noreply.github.com>
Ravi Chavali <ravichavali@gmail.com> Karmyq Developer <karmyq@example.com>
Pallavi Ravi <kompella.chavali@gmail.com> kompellachavali <kompella.chavali@gmail.com>
```

- [ ] **Verify the mailmap actually collapses** — 6 identities become 3 plus dependabot

```bash
git shortlog -sne --all | head
```

---

## Task 2: Write the consistency gate FIRST (TDD — this task ends RED)

**Files:**
- Create: `tests/regression/sprint-123-license-consistency-gate.test.ts`

This is written against the **target** state, so it fails until Tasks 3–5 land. That is the point.

- [ ] **Build the normalizer and the source table**

```typescript
const EXPECTED_SPDX = 'AGPL-3.0-or-later';
const EXPECTED_FAMILY = 'AGPL-3.0';

/** Normalize any human or SPDX spelling to a comparable family token. */
function normalizeLicense(raw: string | null): string | null {
  if (!raw) return null;
  const s = raw.replace(/--/g, '-').toLowerCase();        // un-escape shields.io badges
  if (/agpl[\s-]*v?3|affero general public license/.test(s)) return 'AGPL-3.0';
  if (/\bmit\b/.test(s)) return 'MIT';
  return 'OTHER';
}

/** Each site declares how to pull its claim out. Returning null is a FAILURE, not a skip. */
const PROSE_SITES: Array<{ name: string; file: string; extract: (c: string) => string | null }> = [
  { name: 'README badge',      file: 'README.md',
    extract: c => c.match(/img\.shields\.io\/badge\/license-([^-]+(?:--[^-]+)*)-/)?.[1] ?? null },
  { name: 'README section',    file: 'README.md',
    extract: c => c.match(/##\s*.*License[\s\S]{0,200}?licensed under the ([^\n—-]+?)\s*(?:License)?\s*[-—]/i)?.[1] ?? null },
  { name: 'CONTRIBUTING',      file: 'CONTRIBUTING.md',
    extract: c => c.match(/contributions are licensed under the ([^\n.]+?)\.?$/im)?.[1] ?? null },
  { name: 'mobile README',     file: 'apps/mobile/README.md',
    extract: c => c.match(/##\s*License\s*\n+\s*([A-Za-z0-9.\-+]+)/)?.[1] ?? null },
  { name: 'landing Footer',    file: 'apps/landing/src/components/Footer.tsx',
    extract: c => c.match(/Open source,\s*([A-Za-z0-9.\-+]+)/)?.[1] ?? null },
  { name: 'landingContent',    file: 'apps/landing/src/lib/landingContent.ts',
    extract: c => c.match(/the\s+([A-Za-z0-9.\-+]+)\s+license keeps it that way/)?.[1] ?? null },
];
```

- [ ] **Assert LICENSE is genuinely AGPL-3.0, not merely present**

```typescript
it('LICENSE is the verbatim AGPL-3.0 text with the right copyright holder', () => {
  const text = read('LICENSE');
  expect(text).toContain('GNU AFFERO GENERAL PUBLIC LICENSE');
  expect(text).toContain('Version 3, 19 November 2007');
  expect(text).toContain('<https://www.gnu.org/licenses/>');
  expect(text).toMatch(/Copyright \(C\) 2025-2026 Ravi Chavali/);
  expect(text.split('\n').length).toBeGreaterThan(600);   // a truncated paste fails
});
```

- [ ] **Assert every prose site extracts non-null AND agrees** (note 3: null is red)

```typescript
it('every prose claim site is readable and agrees', () => {
  const results = PROSE_SITES.map(s => ({ name: s.name, family: normalizeLicense(s.extract(read(s.file))) }));
  expect(results.filter(r => r.family === null).map(r => r.name)).toEqual([]);  // unreadable = FAIL
  expect([...new Set(results.map(r => r.family))]).toEqual([EXPECTED_FAMILY]);
});
```

- [ ] **Assert all manifests carry exact SPDX, with the list DISCOVERED not hand-written** (note 8)

```typescript
function discoverManifests(): string[] {
  const out = ['package.json', 'tests/package.json', 'scripts/package.json'];
  for (const dir of ['services', 'apps', 'packages']) {
    for (const entry of readdirSync(join(ROOT, dir))) {
      const p = `${dir}/${entry}/package.json`;
      if (existsSync(join(ROOT, p))) out.push(p);
    }
  }
  return out;
}

it('every workspace manifest declares the exact SPDX id', () => {
  const manifests = discoverManifests();
  expect(manifests.length).toBeGreaterThanOrEqual(18);      // discovery itself must not silently shrink
  const wrong = manifests.filter(m => JSON.parse(read(m)).license !== EXPECTED_SPDX);
  expect(wrong).toEqual([]);
});
```

- [ ] **Assert no unallowlisted new claim site appears**

```typescript
const ALLOWLIST = [
  'docs/archive/',                                  // archived; already says AGPL-3.0
  'apps/frontend/IMPLEMENTATION_SUMMARY.md',        // "MIT license compatible" = about OSM deps, not Karmyq
  'docs/superpowers/',                              // specs/plans quoting the contradiction being fixed
  '.claude/handoff/',                               // handoffs quoting the same
  'package-lock.json',                              // dependency metadata
];
```

The check greps tracked, non-generated files for `\bMIT\b|AGPL` and fails on any hit outside the six
enumerated sites and the allowlist, with a message telling the author to fix the claim or allowlist
the path deliberately.

- [ ] **Verify the gate is RED for the right reason** (no LICENSE yet, sites still disagree)

```bash
cd tests && npx jest regression/sprint-123-license-consistency-gate.test.ts
```

---

## Task 3: Create the LICENSE file

**Files:**
- Create: `LICENSE`

- [ ] **Fetch the canonical text — never hand-type it** (note 1)

```bash
node -e "
fetch('https://www.gnu.org/licenses/agpl-3.0.txt')
  .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
  .then(t => { require('fs').writeFileSync('LICENSE', t); console.log('lines:', t.split('\n').length); })
  .catch(e => { console.error('FETCH FAILED —', e.message, '— STOP, do not approximate'); process.exit(1); });
"
```

- [ ] **Append the copyright + how-to-apply block** naming `Ravi Chavali` and the year range
      `2025-2026`, per the AGPL's own "How to Apply These Terms" section

- [ ] **Verify the file is intact and correct**

```bash
node -e "
const t = require('fs').readFileSync('LICENSE','utf8');
const checks = {
  header: t.includes('GNU AFFERO GENERAL PUBLIC LICENSE'),
  version: t.includes('Version 3, 19 November 2007'),
  closing: t.includes('<https://www.gnu.org/licenses/>'),
  copyright: /Copyright \(C\) 2025-2026 Ravi Chavali/.test(t),
  lines: t.split('\n').length,
};
console.log(checks);
if (!checks.header || !checks.version || !checks.closing || !checks.copyright || checks.lines < 600) process.exit(1);
"
```

---

## Task 4: License field on all 18 manifests

**Files:**
- Modify: all manifests returned by discovery (root, `tests`, `scripts`, 3 × `apps`,
  1 × `packages`, 10 × `services`)

- [ ] **Add `"license": "AGPL-3.0-or-later"` to each manifest**, placed next to `version` per npm
      convention. **Edit `package.json` directly — never `npm install`, `npm pkg set --workspaces`,
      or a lockfile regen**, which rewrite exact pins to ranges and churn unrelated packages
      (CLAUDE.md "Dependency edits are surgical")

- [ ] **Confirm `package-lock.json` is untouched** — adding a `license` field must not move the lock

```bash
git diff --stat -- package-lock.json   # expect: empty
```

- [ ] **Verify all 18 and that discovery still finds 18**

```bash
node -e "
const fs=require('fs'),path=require('path');
const list=['package.json','tests/package.json','scripts/package.json'];
for (const d of ['services','apps','packages'])
  for (const e of fs.readdirSync(d)) { const p=d+'/'+e+'/package.json'; if (fs.existsSync(p)) list.push(p); }
const bad=list.filter(p=>JSON.parse(fs.readFileSync(p,'utf8')).license!=='AGPL-3.0-or-later');
console.log('manifests:',list.length,'| wrong:',bad);
if (bad.length||list.length<18) process.exit(1);
"
```

- [ ] **Prove strict install still resolves** (the lock was not disturbed)

```bash
npm ci --dry-run
```

---

## Task 5: Reconcile all six prose claim sites — the gate goes GREEN here

**Files:**
- Modify: `README.md`, `CONTRIBUTING.md`, `apps/mobile/README.md`,
  `apps/landing/src/components/Footer.tsx`, `apps/landing/src/lib/landingContent.ts`

- [ ] **`README.md:4`** — badge to AGPL, hyphens escaped as `--` (note 10)

```markdown
[![License](https://img.shields.io/badge/license-AGPL--3.0--or--later-blue.svg)](LICENSE)
```

- [ ] **`README.md:164`** — license section states AGPL-3.0-or-later and links to `LICENSE`
- [ ] **`CONTRIBUTING.md:52`** — ⚠️ the live contributor agreement (note 9). Contributions are
      licensed under AGPL-3.0-or-later
- [ ] **`apps/mobile/README.md:363`** — align to `AGPL-3.0-or-later`; its `../../LICENSE` link now
      resolves
- [ ] **`Footer.tsx:26`** — keep the human "AGPLv3" phrasing, link it to the repository `LICENSE`
- [ ] **`landingContent.ts:278`** — body already claims AGPLv3; adjust only if the extractor needs
      the token unambiguous

- [ ] **Verify both previously-broken `LICENSE` links now resolve**

```bash
test -f LICENSE && echo "README link OK"
test -f apps/mobile/../../LICENSE && echo "mobile README link OK"
```

- [ ] **The gate must now be GREEN** (run directly, not through Turbo — note 5)

```bash
cd tests && npx jest regression/sprint-123-license-consistency-gate.test.ts
```

---

## Task 6: Prove the gate can actually fail

Per ADR-091: a green gate run proves nothing. One injection is not proof either.

- [ ] **Table-driven per-source flip, inside the test file** — for each of the 6 prose sites, feed
      that site's real extractor synthetic MIT content and assert it returns `MIT`; feed it content
      with the claim removed and assert it returns `null`. This proves every extractor is live and
      discriminating, not just the first one

```typescript
describe('each extractor is proven able to fail', () => {
  it.each(PROSE_SITES.map(s => [s.name, s]))('%s detects a flipped claim and an absent one', (_n, site) => {
    const real = read(site.file);
    const flipped = real.replace(/AGPL--3\.0--or--later|AGPL-3\.0-or-later|AGPLv3|AGPL-3\.0/g, 'MIT');
    expect(normalizeLicense(site.extract(flipped))).toBe('MIT');       // discriminating
    expect(site.extract('')).toBeNull();                                // absence is detectable
  });
});
```

- [ ] **One real on-disk flip.** Edit `README.md:4` to the MIT badge, run the gate, **watch it go
      red**, revert, run again, watch it go green

```bash
cd tests && npx jest regression/sprint-123-license-consistency-gate.test.ts   # after flip: EXPECT FAIL
git checkout README.md
cd tests && npx jest regression/sprint-123-license-consistency-gate.test.ts   # after revert: EXPECT PASS
```

- [ ] **Paste both outputs into the PR description.** A gate whose red state was never observed is
      an unverified claim, not a gate

---

## Task 7: ADR-092 + ADR-093 + index

**Files:**
- Create: `docs/adr/ADR-092-agpl-licensing-and-manifesto-audit.md`,
  `docs/adr/ADR-093-federation-schema-reserved.md`
- Modify: `docs/adr/README.md`

- [ ] **Confirm 092/093 are still free** before writing (the arc design called them indicative)

```bash
ls docs/adr | grep -E 'ADR-09[0-9]'
```

- [ ] **ADR-092** — Status `Accepted`. Follow `docs/adr/template.md`. Must contain:
  - The decision: AGPL-3.0-or-later, and **why not MIT** (network copyleft is what makes the
    manifesto's "their changes stay open too" true)
  - The provenance table **as re-measured in Task 1**, and the zero-distribution finding
    (`forkCount: 0`, `stargazerCount: 0`, `watchers: 0`)
  - ⚠️ **Pallavi Ravi's consent recorded as VERBAL, with no written artifact** — stated plainly.
    Confirmed by the maintainer on 2026-08-07 during Sprint 123 planning. Do not imply a paper
    trail exists. *(If the maintainer supplies the date the verbal agreement was actually given,
    record it; otherwise state the confirmation date and that the underlying date is unrecorded.)*
  - `Karmyq Developer <karmyq@example.com>` confirmed as the maintainer's own pre-config identity
  - The audit: 9 holding claims with `file:line`, F1/F2/F3, reverse findings
  - **The 7 UNVERIFIED §2.4 claims as an explicit follow-up list**, each marked as neither holding
    nor failing, with the search that would settle it
  - F2/F3 handed to S124 with their open semantic questions intact

- [ ] **ADR-093** — Status `Accepted`. `federation` is reserved scaffolding. **Verify the negative
      before asserting it** (Discipline 5 — a negative without a stated scope is not evidence)

```bash
grep -rn "federation\." services/ packages/ apps/frontend/src apps/mobile --include=*.ts --include=*.tsx | grep -v node_modules
```

  State the search scope inline in the ADR, and record that the schema is **deliberately not
  deleted**: `init.sql` is generated from migrations and the demo DB carries it.

- [ ] **Add both to `docs/adr/README.md`** under "— Infrastructure —" in the existing
      `- [ADR-0NN: Title](file.md) — **Status**` format

- [ ] **Verify the existing drift gate accepts them**

```bash
cd tests && npx jest regression/doc-context-drift-gate.test.ts
```

---

## Task 8: CLAUDE.md schema count

**Files:**
- Modify: `CLAUDE.md` (line 175), `AGENTS.md` if it repeats the count

- [ ] **Change "13 schemas, not 6" to 12 live + 1 reserved**, naming `federation` and linking
      ADR-093

- [ ] **Verify no other doc repeats the old count**

```bash
grep -rn "13 schemas" --include=*.md . | grep -v node_modules
```

- [ ] **Stage CLAUDE.md carefully on Windows** — tracked lowercase (note 11)

```bash
git add claude.md AGENTS.md && git status --short
```

---

## Task 9: Landing docs — concept page + generator wiring

**Files:**
- Create: `docs/concepts/open-source-and-agpl.md`
- Modify: `scripts/generate-docs.ts`

- [ ] **Write the concept page** — what AGPL-3.0-or-later means for someone who forks or self-hosts
      Karmyq: you may use, modify and run it; if you run a modified version as a network service,
      your changes must be available to its users. Ties directly to the manifesto's "Fork it,
      improve it, make it yours"

- [ ] **Wire ADR-092/093 into `ADR_GROUPS`** (`scripts/generate-docs.ts`, "— Infrastructure —",
      line ~520) — add `adr-092-agpl-licensing-and-manifesto-audit` and
      `adr-093-federation-schema-reserved` at the top, matching the existing newest-first order

- [ ] **Wire the concept page into BOTH lists** (note 6) — `CONCEPT_ORDER` (line ~245) for reading
      order and `whyKarmyq` (line 578) for nav placement. Missing either breaks
      `doc-context-drift-gate.test.ts`

- [ ] **Regenerate and verify all three pages land in nav** — `nav.json` is generated; never edit it

```bash
cd apps/landing && npm run generate-docs && cd ../..
node -e "
const nav=require('fs').readFileSync('apps/landing/src/data/docs/nav.json','utf8');
for (const s of ['adr-092','adr-093','open-source-and-agpl'])
  console.log(s, nav.includes(s) ? 'OK' : 'MISSING');
"
```

`apps/landing/src/data/docs/` is **tracked, not gitignored** (160 files under version control),
so plain `git add` is correct — no `-f` needed.

- [ ] **Run the drift gate — it enforces exactly this**

```bash
cd tests && npx jest regression/doc-context-drift-gate.test.ts
```

---

## Task 10: SDLC quality gates

All four run every sprint. Effort calibrated to diff size: this is a small, well-specified diff, so
one `/simplify` pass and `/code-review` at **medium**.

- [ ] **`/simplify`** on the branch diff — one pass. The gate test is the only real code; check the
      extractor table for duplication and the allowlist for dead entries

```bash
git diff origin/master --stat
```

- [ ] **`/code-review`** on the branch diff at medium. ⚠️ **Maintainer-invoked only** — the agent
      cannot run it. Ask the maintainer to run it and hand back findings; do not record it as done
      otherwise. Focus the reviewer on the gate's ability to fail, not its ability to pass

- [ ] **`/security-review`** on the branch diff. Low expected yield (no runtime code), but the
      license change is outward-facing and the review is mandatory

- [ ] **Resolve or dismiss every finding with written justification.** Use the `/review-response`
      skill — verify each finding against the repo before fixing it

- [ ] **Verify the standing CI gates are green** — dependency audit (ADR-059) and code scanning
      (ADR-060) run automatically on push. If both go red together on a diff with no dependency
      change, that is a newly-published advisory, not this branch

---

## Task 11: Final verification

- [ ] **Type check**

```bash
npx tsc --noEmit -p tests/tsconfig.json && npx tsc --noEmit -p apps/landing/tsconfig.json
```

- [ ] **Full blocking suite**

```bash
npm test
```

- [ ] **Revert incidental landing-docs churn** (note 7) — `npm test` reruns `generate-docs`, which
      rewrites timestamps and HEAD shas. Keep the ADR/concept additions, drop the rest

```bash
git diff --stat -- apps/landing/src/data/docs/
```

- [ ] **Advisory doc check**

```bash
npm run feedback:check
```

- [ ] **Re-run the license gate directly** — the last word, outside Turbo's cache

```bash
cd tests && npx jest regression/sprint-123-license-consistency-gate.test.ts
```

- [ ] **Confirm the Definition of Done in the spec is fully met**, including that the gate's red
      state was observed and pasted into the PR

- [ ] **Update `.claude/handoff/CURRENT_HANDOFF.md`** and land it **in this PR, before asking for
      merge authorization** — a handoff merged separately gets stranded

---

## Task 12: Merge + Deploy

Use the `/deploy` skill. CI/CD first — never a manual deploy while the pipeline is available.

- [ ] **Open the PR** with the contract headers `pr-contract.yml` requires, both gate outputs
      (red and green), and the license decision summary

- [ ] **Merge to master.** ⚠️ `gh pr merge --squash --admin` needs **explicit maintainer
      authorization each time**; `gh pr merge --admin` via Bash is blocked by the permission
      classifier — use the GitHub MCP `merge_pull_request` tool

- [ ] **Monitor GitHub Actions** — tests, ARM64 build, SSH deploy, health verify, rollback on
      failure. No migration scripts this sprint, so no SSH step is needed

- [ ] **Verify GitHub now detects the license** — the externally-visible proof that F1 is closed

```bash
gh repo view --json licenseInfo,visibility
```

- [ ] **Smoke-test the demo with real paths** (`/health` 404s through nginx; `curl`/`jq` unusable —
      use `node -e` + `fetch`): landing 200 · bodyless `POST /api/auth/login` 400 `VALIDATION_ERROR`
      · wrong password 401 `UNAUTHORIZED`

- [ ] **Verify the landing site serves the new pages** — `/docs/concepts/open-source-and-agpl`,
      `/docs/concepts/adr-092-…`, and the footer's `LICENSE` link

- [ ] **Flip ADR-092 and ADR-093 to `Implemented`** once deployed — but fold it into the next
      sprint's PR. **No docs-only master push** (note 12)

- [ ] **Reconcile the handoff against real state** — `gh pr list`, `git log`, current branch. A
      handoff describing a PR as pending when it is merged is a blocking defect

---

## Out of scope, deliberately

| Item | Why |
|---|---|
| F2 — provider standing enforcement | Sprint 124 |
| F3 — `provider_services_enabled` / `provider_min_personal_trust_score` enforcement | Sprint 124 |
| The 7 UNVERIFIED §2.4 claims | Recorded as follow-up in ADR-092 (D13) |
| Deleting the `federation` schema | ADR-093 documents it as reserved; deletion is a migration with real risk and no user benefit |
| `private: true` on the 10 service manifests | Offered and not chosen; recorded in the spec so it is visibly a decision |
| Written confirmation of Pallavi's consent | Offered and declined (D11); recorded honestly in ADR-092 as verbal |
| `.github/copilot-instructions.md`, `.github/instructions/` | Untracked mermaid tooling from 2026-07-29, unrelated to this sprint. Leave untracked or handle separately |
