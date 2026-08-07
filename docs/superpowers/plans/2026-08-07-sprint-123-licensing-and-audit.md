# Sprint 123: Licensing Decision + Record the Audit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Publish AGPL-3.0-or-later, reconcile all thirteen contradictory license claim sites and
twenty manifests, record the manifesto audit as ADR-092 and the `federation` fossil as ADR-093, and
add a regression gate that fails when any two license sources disagree.

**Architecture:** No service, endpoint, schema or event changes. The new runtime artifact is a
repo-wide regression gate in `tests/regression/` that reads thirteen prose claim sites and twenty
`git ls-files`-discovered manifests, normalizes each to a license family, and fails on disagreement,
on absence, and on any unallowlisted new claim.

**Tech Stack:** Node.js 24/Express 5/TypeScript, Next.js 15, PostgreSQL 15, Bull queue, Jest 30.

**Spec:** [`2026-08-07-sprint-123-licensing-and-audit-design.md`](../specs/2026-08-07-sprint-123-licensing-and-audit-design.md)
**Arc:** [`2026-08-06-sprint-123-126-manifesto-alignment-arc-design.md`](../specs/2026-08-06-sprint-123-126-manifesto-alignment-arc-design.md) §4 S123

> **Revised 2026-08-07 after external review.** Task order changed: the claim sites are reconciled
> **before** the extractors are finalized, because the first version's regexes were written against
> imagined text and one of them rejected the string it was designed to accept. See the spec's
> *Revision history* for all seven corrections.

---

## File Map

### New files to create

| File | Responsibility |
|------|---------------|
| `LICENSE` | **Byte-exact** GNU AGPL v3 text. No appended notice |
| `.mailmap` | Collapse the maintainer's five git identities |
| `tests/regression/sprint-123-license-consistency-gate.test.ts` | The gate |
| `docs/adr/ADR-092-agpl-licensing-and-manifesto-audit.md` | Licensing decision + the audit |
| `docs/adr/ADR-093-federation-schema-reserved.md` | `federation` is reserved, not deleted |
| `docs/concepts/open-source-and-agpl.md` | User-facing: what AGPL means if you fork or self-host |

### Existing files to modify

| File | Change |
|------|--------|
| **20** `package.json` files (`git ls-files '*package.json'`) | Add `"license": "AGPL-3.0-or-later"` |
| `package.json` + `package-lock.json` | Version 11.42.0 → **11.43.0** (3 lines total) |
| `README.md:4` | Badge MIT → AGPL-3.0-or-later; link now resolves |
| `README.md:164` | License section + **the copyright notice** (D9) |
| `CONTRIBUTING.md:52` | Contributor agreement MIT → AGPL-3.0-or-later |
| `apps/mobile/README.md:363` | Align to `AGPL-3.0-or-later`; link now resolves |
| `services/*/README.md` × 10 | 7 corrected from MIT; 3 gain a License section |
| `apps/landing/src/components/Footer.tsx:26` | Link "AGPLv3" to the repository `LICENSE` |
| `apps/landing/src/lib/landingContent.ts:278` | Align token if the extractor needs it unambiguous |
| `scripts/generate-docs.ts` | `ADR_GROUPS` (+2), `CONCEPT_ORDER` and `whyKarmyq` (+1) |
| `docs/adr/README.md` | Index entries for ADR-092, ADR-093 |
| `CLAUDE.md:175` | "13 schemas" → 12 live + 1 reserved |
| `AGENTS.md` | Sync schema count if repeated |

---

## ⚠️ Critical Implementation Notes (read before Task 2)

1. **Branch from the planning branch, not `origin/master`.** The spec and plan exist only on
   `docs/sprint-123-planning` at **local** HEAD — they are on neither `origin/master` nor the pushed
   planning branch (`origin/docs/sprint-123-planning` is at `9a88cc96`, two commits behind).
   Branching from `origin/master` produces a working tree with no plan in it.
2. **The AGPL text is copied verbatim and left byte-exact.** Fetch
   `https://www.gnu.org/licenses/agpl-3.0.txt` with `node -e` + `fetch` (`curl` is unreliable here —
   spurious status 000). **Do not append a copyright block to `LICENSE`** — GitHub's detection is
   similarity-based and `licenseInfo != null` is a Definition-of-Done item. The D9 notice goes in
   `README.md`, per GNU's `gpl-howto`. If the fetch fails, stop and ask — do not approximate.
3. **The gate goes in `tests/regression/`, not `tests/tdd/`.** Root `tests/tdd/` never
   auto-promotes (`scripts/promote-tdd-tests.js` walks only `services/*` and `apps/*`), so a gate
   left there blocks nothing. See `tests/CLAUDE.md`.
4. **Write extractors against committed fixtures, never speculation.** Task 4 lands the final
   wording *before* Task 5 finalizes the extractors. The first version's `CONTRIBUTING` regex used
   `[^\n.]+`, which excludes periods, so it returned `null` for `AGPL-3.0-or-later` — the very
   string it was written to accept.
5. **A null extraction must fail the gate, not skip it.** Presence-instead-of-blocking is this
   repo's recurring gate defect.
6. **Prove each extractor can fail, not just one.** Table-driven MIT-flip across all 13 sites, plus
   one real on-disk flip. ⚠️ **Restore the flip with a targeted revert** — `git checkout README.md`
   discards Task 4's uncommitted reconciliation of the same file.
7. **Run the gate directly, never through Turbo:**
   `cd tests && npx jest regression/sprint-123-license-consistency-gate.test.ts`. Turbo's cache
   misses cross-workspace test inputs.
8. **`nav.json` is generated and hand-edits silently revert.** Source is `scripts/generate-docs.ts`:
   `ADR_GROUPS` (~line 520); the concept page needs **both** `CONCEPT_ORDER` (~245) and `whyKarmyq`
   (line 578). All 89 ADRs are curated there, and `doc-context-drift-gate.test.ts` fails on any
   concept page missing from nav.
9. **`npm test` regenerates the landing docs** — commit the intended additions, revert incidental
   timestamp/HEAD-sha churn.
10. **The manifest list is discovered via `git ls-files`, never hand-written.** There are **20**.
    A directory glob missed `tests/e2e`, `tests/load`, `tests/performance` in the first version.
11. **The version bump touches the lockfile.** `e5dc24ce` proves the shape: `package.json` ×1 and
    `package-lock.json` ×2 (`.version`, `.packages[""].version`). "Lockfile untouched" is **wrong**
    — the correct assertion is *only those lines change*.
12. **The shields.io badge escapes hyphens** — `AGPL-3.0-or-later` renders as
    `license-AGPL--3.0--or--later-blue`. The normalizer un-escapes `--` before comparing.
13. **`git add` CLAUDE.md carefully on Windows** — tracked lowercase as `claude.md`.
14. **No docs-only push to master.**

---

## Task 1: Branch + `.mailmap` + provenance baseline

**Files:**
- Create: `.mailmap`

- [ ] **Branch from the planning branch's local HEAD** (note 1)

```bash
git rev-parse --abbrev-ref HEAD          # expect: docs/sprint-123-planning
git log --oneline -1                     # expect the plan-correction commit
git checkout -b feature/sprint-123-licensing-and-audit
ls docs/superpowers/plans/2026-08-07-sprint-123-licensing-and-audit.md   # must exist
```

- [ ] **Re-measure provenance at HEAD** — ADR-092's table is read out of git, not copied

```bash
git log --all --format='%aN <%aE>' | sort | uniq -c | sort -rn
```

- [ ] **Create `.mailmap`** collapsing the maintainer's five identities (D11 — all are the
      maintainer's own, per attestation)

```
Ravi Chavali <ravichavali@gmail.com> <ravichavali@users.noreply.github.com>
Ravi Chavali <ravichavali@gmail.com> <kompella.chavali@gmail.com>
Ravi Chavali <ravichavali@gmail.com> <karmyq@example.com>
```

- [ ] **Verify it collapses to one human author + dependabot**

```bash
git shortlog -sne --all
```

---

## Task 2: Create the LICENSE file — byte-exact, nothing appended

**Files:**
- Create: `LICENSE`

- [ ] **Fetch the canonical text — never hand-type it** (note 2)

```bash
node -e "
fetch('https://www.gnu.org/licenses/agpl-3.0.txt')
  .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
  .then(t => { require('fs').writeFileSync('LICENSE', t); console.log('lines:', t.split('\n').length); })
  .catch(e => { console.error('FETCH FAILED —', e.message, '— STOP, do not approximate'); process.exit(1); });
"
```

- [ ] **Do NOT append a copyright block.** The D9 notice goes in `README.md` in Task 4. GNU's
      `gpl-howto` says attach notices to the program, not to the license; GitHub's detection is
      similarity-based and a modified `LICENSE` can defeat it

- [ ] **Verify the file is canonical and unmodified**

```bash
node -e "
const t = require('fs').readFileSync('LICENSE','utf8');
const checks = {
  header:   t.includes('GNU AFFERO GENERAL PUBLIC LICENSE'),
  version:  t.includes('Version 3, 19 November 2007'),
  closing:  t.includes('<https://www.gnu.org/licenses/>'),
  noNotice: !/Copyright \(C\) 20\d\d(-20\d\d)? Ravi/.test(t),   // must stay canonical
  lines:    t.split('\n').length,
};
console.log(checks);
if (!checks.header || !checks.version || !checks.closing || !checks.noNotice || checks.lines < 600) process.exit(1);
"
```

---

## Task 3: License field on all 20 manifests

**Files:**
- Modify: every path from `git ls-files '*package.json'` (20 files)

- [ ] **Enumerate from the live arbiter first** (note 10) — never a directory glob

```bash
git ls-files '*package.json' | grep -v node_modules
```

Expect exactly 20: root, `apps/*` ×3, `packages/shared`, `services/*` ×10, `tests`, `scripts`,
`tests/e2e`, `tests/load`, `tests/performance`.

- [ ] **Add `"license": "AGPL-3.0-or-later"` to each**, next to `version` per npm convention. **Edit
      `package.json` directly — never `npm install`, `npm pkg set --workspaces`, or a lockfile
      regen**, which rewrite exact pins to ranges and churn unrelated packages

- [ ] **Verify all 20 via the same arbiter the gate uses**

```bash
node -e "
const {execSync}=require('child_process'), fs=require('fs');
const list=execSync(\"git ls-files '*package.json'\",{encoding:'utf8'}).split('\n')
  .filter(p=>p && !p.includes('node_modules'));
const bad=list.filter(p=>JSON.parse(fs.readFileSync(p,'utf8')).license!=='AGPL-3.0-or-later');
console.log('manifests:',list.length,'| wrong:',bad);
if (bad.length || list.length!==20) process.exit(1);
"
```

- [ ] **Inspect the lockfile diff** — adding `license` to root may mirror into `packages[""]`.
      Read the actual diff; do not assume it is empty (note 11)

```bash
git diff -- package-lock.json
```

- [ ] **Prove strict install still resolves**

```bash
npm ci --dry-run
```

---

## Task 4: Reconcile all thirteen prose claim sites

**Files:**
- Modify: `README.md`, `CONTRIBUTING.md`, `apps/mobile/README.md`, `services/*/README.md` × 10,
  `apps/landing/src/components/Footer.tsx`, `apps/landing/src/lib/landingContent.ts`

This lands the **final committed wording** that Task 5's extractors are then written against
(note 4).

- [ ] **`README.md:4`** — badge to AGPL, hyphens escaped as `--` (note 12)

```markdown
[![License](https://img.shields.io/badge/license-AGPL--3.0--or--later-blue.svg)](LICENSE)
```

- [ ] **`README.md:164`** — license section states AGPL-3.0-or-later, links `LICENSE`, **and carries
      the D9 copyright notice** (this is where it lives, not in `LICENSE`)

```markdown
## 📝 License

Copyright (C) 2025-2026 Ravi Chavali

This project is licensed under the AGPL-3.0-or-later License - see the [LICENSE](LICENSE) file for details.
```

- [ ] **`CONTRIBUTING.md:52`** — the live contributor agreement

```markdown
By contributing, you agree your contributions are licensed under the AGPL-3.0-or-later License.
```

- [ ] **`apps/mobile/README.md:363`** → `AGPL-3.0-or-later - See [LICENSE](../../LICENSE) for details.`

- [ ] **Seven service READMEs** — `auth`, `cleanup`, `community`, `messaging`, `notification`,
      `reputation`, `request`: replace the bare `MIT` under `## License` with `AGPL-3.0-or-later`

- [ ] **Three service READMEs gain a License section** — `geocoding`, `simulation`, `social-graph`.
      This makes the invariant uniform ("every service README states the license") instead of
      conditional, which is the weaker shape this repo keeps getting caught by

- [ ] **`Footer.tsx:26`** — link the human "AGPLv3" text to the repository `LICENSE`. ⚠️ The link
      inserts JSX between the comma and the token; Task 5's extractor is written against **this**
      committed markup

- [ ] **`landingContent.ts:278`** — already claims AGPLv3; adjust only if the token is ambiguous

- [ ] **Verify every site now reads AGPL and no MIT claim survives outside the allowlist**

```bash
git grep -n -i -E '\bMIT\b' -- '*.md' '*.ts' '*.tsx' \
  ':!node_modules' ':!docs/archive' ':!docs/superpowers' ':!.claude/handoff' \
  ':!apps/frontend/IMPLEMENTATION_SUMMARY.md'
```

Expect **no output**.

- [ ] **Verify both previously-broken `LICENSE` links resolve**

```bash
test -f LICENSE && test -f apps/mobile/../../LICENSE && echo "both links OK"
```

- [ ] **Commit this task before Task 6's injection** — so the on-disk flip can be reverted without
      destroying it (note 6)

---

## Task 5: Write the consistency gate against the committed text

**Files:**
- Create: `tests/regression/sprint-123-license-consistency-gate.test.ts`

- [ ] **Build the normalizer**

```typescript
const EXPECTED_SPDX = 'AGPL-3.0-or-later';
const EXPECTED_FAMILY = 'AGPL-3.0';

/** Normalize any human, badge-escaped or SPDX spelling to a comparable family token. */
function normalizeLicense(raw: string | null): string | null {
  if (!raw) return null;
  const s = raw.replace(/--/g, '-').trim().toLowerCase();     // un-escape shields.io
  if (/agpl[\s-]*v?3|affero general public license/.test(s)) return 'AGPL-3.0';
  if (/\bmit\b/.test(s)) return 'MIT';
  return 'OTHER';
}
```

- [ ] **Write one extractor per site, each verified against the real file as committed in Task 4.**
      Run each extractor against its actual file the moment it is written — an extractor that has
      never been executed against real bytes is a guess (note 4)

```typescript
type Site = { name: string; file: string; extract: (c: string) => string | null };

const PROSE_SITES: Site[] = [
  { name: 'README badge', file: 'README.md',
    extract: c => c.match(/shields\.io\/badge\/license-(.+?)-(?:green|blue|brightgreen)\.svg/)?.[1] ?? null },
  { name: 'README section', file: 'README.md',
    extract: c => c.match(/licensed under the (.+?) License/)?.[1] ?? null },
  { name: 'CONTRIBUTING', file: 'CONTRIBUTING.md',
    extract: c => c.match(/contributions are licensed under the (.+?) License/)?.[1] ?? null },
  { name: 'mobile README', file: 'apps/mobile/README.md',
    extract: c => c.match(/##\s*License\s*\n+\s*([^\s]+)\s*-\s*See/)?.[1] ?? null },
  // ...10 service READMEs, generated from the service list, same shape
  { name: 'landing Footer', file: 'apps/landing/src/components/Footer.tsx',
    extract: c => c.match(/Open source,[\s\S]{0,120}?\b(AGPLv?3[\w.-]*|MIT)\b/)?.[1] ?? null },
  { name: 'landingContent', file: 'apps/landing/src/lib/landingContent.ts',
    extract: c => c.match(/the\s+(\S+)\s+license keeps it that way/)?.[1] ?? null },
];
```

⚠️ Note the fixes: no `[^\n.]` class (it excluded the period in `3.0`); the footer pattern spans
the JSX the link introduces; the badge pattern is anchored on the color suffix rather than
hyphen-counting.

- [ ] **Assert LICENSE is canonical and unmodified**, and that the notice lives in README

```typescript
it('LICENSE is byte-exact canonical AGPL-3.0 with no project notice appended', () => {
  const t = read('LICENSE');
  expect(t).toContain('GNU AFFERO GENERAL PUBLIC LICENSE');
  expect(t).toContain('Version 3, 19 November 2007');
  expect(t).toContain('<https://www.gnu.org/licenses/>');
  expect(t).not.toMatch(/Copyright \(C\) 20\d\d(-20\d\d)? Ravi/);   // keeps GitHub detection working
  expect(t.split('\n').length).toBeGreaterThan(600);
});

it('README carries the copyright notice', () => {
  expect(read('README.md')).toMatch(/Copyright \(C\) 2025-2026 Ravi Chavali/);
});
```

- [ ] **Assert every prose site is readable AND agrees** (note 5 — null is red)

```typescript
it('every prose claim site is readable and agrees', () => {
  const results = PROSE_SITES.map(s => ({ name: s.name, family: normalizeLicense(s.extract(read(s.file))) }));
  expect(results.filter(r => r.family === null).map(r => r.name)).toEqual([]);   // unreadable = FAIL
  expect([...new Set(results.map(r => r.family))]).toEqual([EXPECTED_FAMILY]);
  expect(PROSE_SITES.length).toBe(13);                                          // scope cannot shrink
});
```

- [ ] **Assert all 20 manifests carry exact SPDX, discovered from `git ls-files`** (note 10)

```typescript
function discoverManifests(): string[] {
  return execSync("git ls-files '*package.json'", { cwd: ROOT, encoding: 'utf8' })
    .split('\n').filter(p => p && !p.includes('node_modules'));
}

it('every tracked manifest declares the exact SPDX id', () => {
  const manifests = discoverManifests();
  expect(manifests.length).toBe(20);                 // identity, not a floor
  expect(manifests.filter(m => JSON.parse(read(m)).license !== EXPECTED_SPDX)).toEqual([]);
});
```

- [ ] **Assert no unallowlisted new claim site**

```typescript
const ALLOWLIST = [
  /^docs\/archive\//,                          // archived; already AGPL-3.0
  /^apps\/frontend\/IMPLEMENTATION_SUMMARY\.md$/,  // "MIT license compatible" = about OSM deps
  /^docs\/superpowers\//, /^\.claude\/handoff\//,  // quote the contradiction being fixed
  /package-lock\.json$/, /^apps\/landing\/src\/data\/docs\//, /^LICENSE$/,
];
```

Scans tracked non-generated files for `\bMIT\b|AGPL|Affero`; fails on any hit outside the 13
enumerated sites and the allowlist, with a message telling the author to fix the claim or allowlist
the path deliberately.

- [ ] **Run it — expect GREEN**, since Tasks 2–4 already landed the target state

```bash
cd tests && npx jest regression/sprint-123-license-consistency-gate.test.ts
```

---

## Task 6: Prove the gate can actually fail

A green gate run proves nothing. One injection is not proof either.

- [ ] **Table-driven per-source flip inside the test file** — every one of the 13 sites, using its
      real extractor

```typescript
describe('each extractor is proven able to fail', () => {
  it.each(PROSE_SITES.map(s => [s.name, s] as const))('%s detects flip and absence', (_n, site) => {
    const flipped = read(site.file).replace(/AGPL--3\.0--or--later|AGPL-3\.0-or-later|AGPLv3/g, 'MIT');
    expect(normalizeLicense(site.extract(flipped))).toBe('MIT');   // discriminating
    expect(site.extract('')).toBeNull();                            // absence detectable
  });
});
```

- [ ] **One real on-disk flip.** Mutate the README badge, run, **watch it go red**

```bash
node -e "
const fs=require('fs'); const p='README.md'; let s=fs.readFileSync(p,'utf8');
fs.writeFileSync(p, s.replace('license-AGPL--3.0--or--later-blue','license-MIT-green'));
console.log('injected');
"
cd tests && npx jest regression/sprint-123-license-consistency-gate.test.ts   # EXPECT FAIL
```

- [ ] **Restore with a targeted revert — NOT `git checkout README.md`** (note 6). Task 4 is
      committed, so a scoped inverse replacement is safe and precise

```bash
node -e "
const fs=require('fs'); const p='README.md'; let s=fs.readFileSync(p,'utf8');
fs.writeFileSync(p, s.replace('license-MIT-green','license-AGPL--3.0--or--later-blue'));
console.log('restored');
"
git diff --stat -- README.md          # expect: empty
cd tests && npx jest regression/sprint-123-license-consistency-gate.test.ts   # EXPECT PASS
```

- [ ] **Paste both outputs into the PR description.** A gate whose red state was never observed is
      an unverified claim, not a gate

---

## Task 7: ADR-092 + ADR-093 + index

**Files:**
- Create: `docs/adr/ADR-092-agpl-licensing-and-manifesto-audit.md`,
  `docs/adr/ADR-093-federation-schema-reserved.md`
- Modify: `docs/adr/README.md`

- [ ] **Confirm 092/093 are still free**

```bash
ls docs/adr | grep -E 'ADR-09[0-9]'
```

- [ ] **ADR-092** — Status `Accepted`, following `docs/adr/template.md`:
  - The decision and **why not MIT**: network copyleft is what makes the manifesto's "their changes
    stay open too" true
  - **Provenance as a maintainer attestation** — five git identities, one author. State it as an
    attestation, because the repository cannot prove address ownership and the maintainer can
  - ⚠️ **Observables at observed strength.** Write *"no GitHub-native forks, stars, or watchers were
    observed (2026-08-07); clones and downloads are not observable"* — **not** "no third party has
    ever received the code." The repository is public (`isPrivate: false`), which is the reason the
    contradictory claims mattered and needs no stronger claim
  - The audit: 9 holding claims with `file:line`, F1/F2/F3, reverse findings
  - **The 7 UNVERIFIED §2.4 claims as an explicit follow-up list** (D13), each marked neither
    holding nor failing, with the search that would settle it
  - F2/F3 handed to S124 with their open semantic questions intact

- [ ] **ADR-093** — Status `Accepted`. **Verify the negative before asserting it**; state the search
      scope inline (a negative without a stated scope is not evidence)

```bash
grep -rn "federation\." services/ packages/ apps/frontend/src apps/mobile --include=*.ts --include=*.tsx | grep -v node_modules
```

- [ ] **Add both to `docs/adr/README.md`** under "— Infrastructure —"

- [ ] **Verify the existing drift gate accepts them**

```bash
cd tests && npx jest regression/doc-context-drift-gate.test.ts
```

---

## Task 8: CLAUDE.md schema count

**Files:**
- Modify: `CLAUDE.md` (line 175), `AGENTS.md` if it repeats the count

- [ ] **"13 schemas, not 6" → 12 live + 1 reserved**, naming `federation` and linking ADR-093

- [ ] **Verify no other doc repeats the old count**

```bash
grep -rn "13 schemas" --include=*.md . | grep -v node_modules
```

- [ ] **Stage carefully on Windows** — tracked lowercase (note 13)

```bash
git add claude.md AGENTS.md && git status --short
```

---

## Task 9: Landing docs — concept page + generator wiring

**Files:**
- Create: `docs/concepts/open-source-and-agpl.md`
- Modify: `scripts/generate-docs.ts`

- [ ] **Write the concept page** — what AGPL-3.0-or-later means for someone who forks or self-hosts:
      you may use, modify and run it; run a modified version as a network service and your changes
      must be available to its users. Ties to the manifesto's "Fork it, improve it, make it yours"

- [ ] **Wire ADR-092/093 into `ADR_GROUPS`** ("— Infrastructure —", ~line 520), newest first

- [ ] **Wire the concept page into BOTH lists** (note 8) — `CONCEPT_ORDER` (~245) and `whyKarmyq`
      (line 578). Missing either breaks `doc-context-drift-gate.test.ts`

- [ ] **Regenerate and verify all three land in nav** — never edit `nav.json`

```bash
cd apps/landing && npm run generate-docs && cd ../..
node -e "
const nav=require('fs').readFileSync('apps/landing/src/data/docs/nav.json','utf8');
for (const s of ['adr-092','adr-093','open-source-and-agpl'])
  console.log(s, nav.includes(s) ? 'OK' : 'MISSING');
"
```

`apps/landing/src/data/docs/` is **tracked, not gitignored** (160 files under version control), so
plain `git add` is correct — no `-f`.

- [ ] **Run the drift gate**

```bash
cd tests && npx jest regression/doc-context-drift-gate.test.ts
```

---

## Task 10: Version bump to 11.43.0

**Files:**
- Modify: `package.json`, `package-lock.json`

The spec promises v11.43.0 and nothing else in this plan delivers it.

- [ ] **Bump the three lines** — root `package.json` `.version`, and `package-lock.json`'s
      `.version` and `.packages[""].version`. Edit in place; **never** `npm version` or a lockfile
      regen (note 11)

- [ ] **Verify the shape matches how v11.42.0 landed** (`e5dc24ce`: 1 line + 2 lines)

```bash
node -e "
const p=require('./package.json'), l=require('./package-lock.json');
console.log({pkg:p.version, lockTop:l.version, lockRoot:l.packages[''].version});
if (p.version!=='11.43.0'||l.version!=='11.43.0'||l.packages[''].version!=='11.43.0') process.exit(1);
"
git diff --stat -- package.json package-lock.json
```

- [ ] **Confirm the doc-drift gate still passes** — CLAUDE.md must reference `package.json`, never a
      hard-coded semver

```bash
cd tests && npx jest regression/doc-context-drift-gate.test.ts
```

---

## Task 11: SDLC quality gates

All four run every sprint. Effort calibrated to diff size: small, well-specified diff, so one
`/simplify` pass and `/code-review` at **medium**.

- [ ] **`/simplify`** on the branch diff — one pass. The gate test is the only real code; check the
      13-site table for duplication (the 10 service READMEs should be generated from a list, not
      hand-repeated) and the allowlist for dead entries

- [ ] **`/code-review`** on the branch diff at medium. ⚠️ **Maintainer-invoked only** — the agent
      cannot run it. Ask the maintainer and hand back findings; do not record it as done otherwise.
      Focus the reviewer on the gate's ability to **fail**

- [ ] **`/security-review`** on the branch diff

- [ ] **Resolve or dismiss every finding with written justification.** Use `/review-response` —
      verify each finding against the repo before fixing it. *(The first version of this plan had
      five real defects that survived authoring; assume this one has some too.)*

- [ ] **Verify the standing CI gates are green** — dependency audit (ADR-059), code scanning
      (ADR-060). Both red together on a no-dependency diff means a newly-published advisory

---

## Task 12: Final verification

- [ ] **Type check**

```bash
npx tsc --noEmit -p tests/tsconfig.json && npx tsc --noEmit -p apps/landing/tsconfig.json
```

- [ ] **Full blocking suite**

```bash
npm test
```

- [ ] **Revert incidental landing-docs churn** (note 9) — keep the ADR/concept additions

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

- [ ] **Walk the spec's Definition of Done item by item**, including that the gate's red state was
      observed and pasted into the PR

- [ ] **Update `.claude/handoff/CURRENT_HANDOFF.md`** and land it **in this PR, before asking for
      merge authorization** — a handoff merged separately gets stranded

---

## Task 13: Merge + Deploy

Use the `/deploy` skill. CI/CD first.

- [ ] **Push the branch and open the PR** with the contract headers `pr-contract.yml` requires, both
      gate outputs (red and green), and the license decision summary

- [ ] **Merge to master.** ⚠️ `gh pr merge --squash --admin` needs **explicit maintainer
      authorization each time**; `gh pr merge --admin` via Bash is blocked by the permission
      classifier — use the GitHub MCP `merge_pull_request` tool

- [ ] **Monitor GitHub Actions** — tests, ARM64 build, SSH deploy, health verify, rollback on
      failure. No migrations this sprint, so no manual SSH step

- [ ] **Verify GitHub now detects the license** — the externally-visible proof that F1 is closed,
      and the reason `LICENSE` had to stay byte-exact

```bash
gh repo view --json licenseInfo,visibility
```

- [ ] **Smoke-test the demo with real paths** (`/health` 404s through nginx; `curl`/`jq` unusable —
      use `node -e` + `fetch`): landing 200 · bodyless `POST /api/auth/login` 400 `VALIDATION_ERROR`
      · wrong password 401 `UNAUTHORIZED`

- [ ] **Verify the landing site serves the new pages** — `/docs/concepts/open-source-and-agpl`,
      `/docs/concepts/adr-092-…`, and the footer's `LICENSE` link

- [ ] **Flip ADR-092/093 to `Implemented`** once deployed, folded into the next sprint's PR.
      **No docs-only master push** (note 14)

- [ ] **Reconcile the handoff against real state** — `gh pr list`, `git log`, current branch

---

## Out of scope, deliberately

| Item | Why |
|---|---|
| F2 — provider standing enforcement | Sprint 124 |
| F3 — `provider_services_enabled` / `provider_min_personal_trust_score` enforcement | Sprint 124 |
| The 7 UNVERIFIED §2.4 claims | Recorded as follow-up in ADR-092 (D13) |
| Deleting the `federation` schema | ADR-093 documents it as reserved; deletion is a migration with real risk and no user benefit |
| `private: true` on the 10 service manifests | Offered and not chosen; recorded so it is visibly a decision |
| Third-party contributor consent | Void — sole authorship attested (D11) |
| `.github/copilot-instructions.md`, `.github/instructions/` | Untracked mermaid tooling from 2026-07-29, unrelated. Leave out of the PR |
