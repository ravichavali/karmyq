import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * Doc / context drift gate.
 *
 * Periodic context-hygiene review (2026-06-22) found that the agent-facing docs
 * drift silently between sprints — CLAUDE.md was ~18 sprints stale, the ADR index
 * was missing 5 ADRs, etc. Each was hand-fixed; nothing *detected* the drift, so
 * it recurred. This gate turns the manual drift-hunt into a blocking CI check:
 * the invariants below must hold, or the build fails.
 *
 * Scope: only invariants that are cheap, deterministic, and file-committed (so they
 * work in a fresh CI checkout). Soft/handoff-status drift is out of scope here.
 */
const ROOT = join(__dirname, '..', '..');

const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

// claude.md is git-tracked lowercase (Windows quirk — see feedback_git_add_windows);
// read case-tolerantly so this passes on case-sensitive CI runners too.
function readRootDoc(name: string): string {
  for (const c of [name, name.toLowerCase()]) {
    const p = join(ROOT, c);
    if (existsSync(p)) return readFileSync(p, 'utf8');
  }
  throw new Error(`root doc not found (tried ${name} / ${name.toLowerCase()})`);
}

/**
 * Duplicate ADR numbers, as a PURE predicate over filenames.
 *
 * Extracted so it can be proven to FAIL. Asserting only against the real docs/adr/
 * directory would be unfalsifiable in practice — the suite would pass forever without
 * anyone knowing whether the check works. Two parallel checkouts deriving "the next ADR
 * number" from the same open-PR list can both mint ADR-097; that collision is the
 * scenario this exists for.
 */
export function duplicateAdrNumbers(filenames: string[]): string[] {
  const byNumber = new Map<string, string[]>();
  for (const f of filenames) {
    const m = /^ADR-(\d+)/.exec(f);
    if (!m) continue;
    const n = m[1];
    byNumber.set(n, [...(byNumber.get(n) ?? []), f]);
  }
  return [...byNumber.entries()]
    .filter(([, files]) => files.length > 1)
    .map(([n, files]) => `ADR-${n}: ${files.sort().join(', ')}`)
    .sort();
}

describe('doc/context drift gate', () => {
  it('CLAUDE.md "Services (N total)" matches services/registry.json', () => {
    const claudeMd = readRootDoc('CLAUDE.md');
    const claimed = claudeMd.match(/Services \((\d+) total\)/);
    expect(claimed).not.toBeNull();

    const registry = JSON.parse(read('services/registry.json'));
    const actual = Array.isArray(registry.services)
      ? registry.services.length
      : Object.keys(registry.services).length;

    expect(Number(claimed![1])).toBe(actual);
  });

  it('CLAUDE.md version line points to package.json (no hard-coded semver that re-stales)', () => {
    // The version was hard-coded (10.11.0) while package.json had moved to 11.17.0.
    // Fixed by referencing package.json; lock that in so a literal version can't creep back.
    const versionLine = readRootDoc('CLAUDE.md')
      .split('\n')
      .find((l) => /\*\*Version\*\*/.test(l));
    expect(versionLine).toBeDefined();
    expect(versionLine).toMatch(/package\.json/);
    expect(versionLine).not.toMatch(/\d+\.\d+\.\d+/); // no frozen x.y.z to drift
  });

  it('every docs/adr/ADR-*.md is linked in the docs/adr/README.md index', () => {
    const adrDir = join(ROOT, 'docs', 'adr');
    const adrFiles = readdirSync(adrDir).filter((f) => /^ADR-\d+.*\.md$/.test(f));
    const index = read('docs/adr/README.md');

    const missing = adrFiles.filter((f) => !index.includes(`](${f})`));
    expect(missing).toEqual([]);
  });

  it('no two ADRs share a number (parallel lanes can both mint the next one)', () => {
    const adrFiles = readdirSync(join(ROOT, 'docs', 'adr')).filter((f) => /^ADR-\d+.*\.md$/.test(f));
    expect(duplicateAdrNumbers(adrFiles)).toEqual([]);
  });

  it('the duplicate-ADR check actually FAILS on a collision (indexing alone would not catch it)', () => {
    // Both files are well-formed and would both be linked in the index, so the
    // "every ADR is indexed" assertion passes on this input. Uniqueness must be
    // its own check.
    expect(
      duplicateAdrNumbers([
        'ADR-096-something.md',
        'ADR-097-lane-a-feature.md',
        'ADR-097-lane-b-feature.md',
      ]),
    ).toEqual(['ADR-097: ADR-097-lane-a-feature.md, ADR-097-lane-b-feature.md']);
  });

  it('every landing concepts/guides doc has a nav.json entry (the "nav.json silently reverts" gotcha)', () => {
    const navPath = 'apps/landing/src/data/docs/nav.json';
    if (!existsSync(join(ROOT, navPath))) {
      // landing docs are generated; if absent in this checkout, skip rather than false-fail.
      return;
    }
    const nav = read(navPath);
    const missing: string[] = [];

    for (const dir of ['concepts', 'guides']) {
      const abs = join(ROOT, 'apps/landing/src/data/docs', dir);
      if (!existsSync(abs)) continue;
      for (const f of readdirSync(abs).filter((x) => x.endsWith('.json'))) {
        let slug = f.replace(/\.json$/, '');
        try {
          slug = JSON.parse(readFileSync(join(abs, f), 'utf8')).slug ?? slug;
        } catch {
          /* fall back to filename stem */
        }
        if (!nav.includes(slug)) missing.push(`${dir}/${f}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('frontend jest.setup mocks next/router (prevents the 8-suite useRouter regression)', () => {
    // Making a widely-rendered component use useRouter broke every suite mounting it
    // (S100). The fix was a global next/router mock in jest.setup — lock it in.
    const setup = read('apps/frontend/jest.setup.js');
    expect(setup).toMatch(/next\/router/);
    expect(setup).toMatch(/useRouter/);
  });
});
