import { execFileSync } from 'child_process';
import { createHash } from 'crypto';

import { ROOT, allServicePaths, read, tracked } from './helpers/workspaces';

/**
 * Sprint 123 — license consistency gate.
 *
 * Before this sprint the repository made **fourteen** contradictory license claims in prose
 * (ten said MIT, three said AGPL, one said "Internal use only") while shipping no LICENSE file
 * at all and no `license` field on any of its twenty manifests. Every one of those claims was
 * publicly readable.
 *
 * The failure mode this gate exists to prevent is *disagreement*, not *absence*. A gate that
 * merely checked "a LICENSE file exists" would have passed straight through the contradiction.
 * So every assertion here compares sources against each other and against one expected value:
 *
 *   - a source that cannot be read at all is a FAILURE, never a skip (a null extraction means
 *     the claim moved and the gate went blind, which is exactly when it must speak up);
 *   - the site count is asserted by identity, not as a floor, so scope cannot silently shrink;
 *   - the manifest list is discovered from `git ls-files` — the live arbiter — never hand-written;
 *   - every extractor is separately proven able to return MIT and null, because "one injection
 *     went red" only proves one extractor works.
 *
 * See ADR-092.
 */

const EXPECTED_SPDX = 'AGPL-3.0-or-later';
const EXPECTED_FAMILY = 'AGPL-3.0';

/**
 * sha256 of the canonical GNU AGPL v3 text as published at
 * https://www.gnu.org/licenses/agpl-3.0.txt (fetched 2026-08-07, 662 lines, 34523 bytes).
 * Computed over LF-normalized bytes so the assertion survives a CRLF checkout on Windows.
 */
const CANONICAL_AGPL_SHA256 = '0d96a4ff68ad6d4b6f1f30f713b18d5184912ba8dd389f86aa7710db079abcb0';

const lfNormalize = (s: string): string => s.replace(/\r\n/g, '\n');

/**
 * Normalize any human, badge-escaped or SPDX spelling to a comparable family token.
 * Returns null only for a genuinely absent claim — callers treat null as a failure.
 */
function normalizeLicense(raw: string | null): string | null {
  if (!raw) return null;
  const s = raw.replace(/--/g, '-').trim().toLowerCase(); // un-escape shields.io hyphens
  if (/agpl[\s-]*v?3|affero general public license/.test(s)) return 'AGPL-3.0';
  if (/\bmit\b/.test(s)) return 'MIT';
  return 'OTHER';
}

type Site = { name: string; file: string; extract: (c: string) => string | null };

/**
 * The uniform License section every service README and the mobile README now carry:
 *
 *     ## License
 *
 *     AGPL-3.0-or-later - See [LICENSE](../../LICENSE) for details.
 *
 * Making the shape uniform is deliberate: it turns "some READMEs state a license" into
 * "every README states the license", which is an invariant a gate can actually enforce.
 */
const licenseSectionExtractor = (c: string): string | null =>
  c.match(/^##\s+License\s*[\r\n]+\s*(\S+)\s+-\s+See/m)?.[1] ?? null;

const PROSE_SITES: Site[] = [
  {
    name: 'README badge',
    file: 'README.md',
    extract: (c) =>
      c.match(/shields\.io\/badge\/license-(.+?)-(?:green|blue|brightgreen|red|orange)\.svg/)?.[1] ??
      null,
  },
  {
    name: 'README license section',
    file: 'README.md',
    extract: (c) => c.match(/licensed under the (.+?) License/)?.[1] ?? null,
  },
  {
    name: 'CONTRIBUTING contributor agreement',
    file: 'CONTRIBUTING.md',
    extract: (c) => c.match(/contributions are licensed under the (.+?) License/)?.[1] ?? null,
  },
  {
    name: 'mobile README',
    file: 'apps/mobile/README.md',
    extract: licenseSectionExtractor,
  },
  // Discovered from services/registry.json, never hand-listed: a service added later must be
  // checked automatically, or the gate quietly stops covering it while still reporting green.
  ...allServicePaths().map((path) => ({
    name: `${path} README`,
    file: `${path}/README.md`,
    extract: licenseSectionExtractor,
  })),
  {
    name: 'landing Footer',
    file: 'apps/landing/src/components/Footer.tsx',
    // The token sits inside a link, so the pattern spans the JSX the anchor introduces. It
    // captures the anchor text generically rather than whitelisting AGPL|MIT — a whitelist would
    // report a foreign claim ("Apache-2.0") as a *missing* one, making the OTHER branch of
    // normalizeLicense unreachable for the one site most likely to be reworded by a designer.
    extract: (c) => c.match(/Open source,[\s\S]{0,260}?>([^<>{}\n]+)<\/a>/)?.[1]?.trim() ?? null,
  },
  {
    name: 'landingContent manifesto copy',
    file: 'apps/landing/src/lib/landingContent.ts',
    extract: (c) => c.match(/the\s+(\S+)\s+license keeps it that way/)?.[1] ?? null,
  },
];

/** Files that legitimately mention a license token without making a claim about this project. */
const CLAIM_SCAN_ALLOWLIST: RegExp[] = [
  /^docs\/archive\//, // historical; preserved as written
  /^docs\/superpowers\//, // specs and plans quote the contradiction being fixed
  /^\.claude\/handoff\//, // same
  /^apps\/landing\/src\/data\/docs\//, // generated by the landing prebuild
  /^apps\/frontend\/IMPLEMENTATION_SUMMARY\.md$/, // "MIT license compatible" — about OSM deps
  /^docs\/adr\/ADR-09[23]-/, // the ADRs that record this decision
  /^docs\/adr\/README\.md$/, // ADR index entries name the decision
  /^docs\/concepts\/open-source-and-agpl\.md$/, // the user-facing explainer
  /^tests\/regression\/sprint-123-license-consistency-gate\.test\.ts$/, // this file
];

/**
 * Tracked files containing a license token, resolved by `git grep` rather than by reading every
 * tracked `.md`/`.ts`/`.tsx` into JS (~1,500 files, ~7.8 MB) to run one regex over each.
 * `git grep -l` exits 1 when nothing matches, which is a legitimate empty result, not an error.
 */
function filesMentioningALicense(): string[] {
  try {
    return execFileSync(
      'git',
      ['grep', '-lIE', '\\bMIT\\b|AGPL|Affero', '--', '*.md', '*.ts', '*.tsx'],
      { cwd: ROOT, encoding: 'utf8' }
    )
      .split(/\r?\n/)
      .filter((p) => p && !p.includes('node_modules'));
  } catch (err) {
    if ((err as { status?: number }).status === 1) return [];
    throw err;
  }
}

describe('Sprint 123 license consistency gate', () => {
  describe('LICENSE', () => {
    it('is the byte-exact canonical AGPL-3.0 text with no project notice appended', () => {
      const t = lfNormalize(read('LICENSE'));

      expect(t).toContain('GNU AFFERO GENERAL PUBLIC LICENSE');
      expect(t).toContain('Version 3, 19 November 2007');
      expect(t).toContain('<https://www.gnu.org/licenses/>');
      // A modified LICENSE defeats GitHub's similarity-based detection, and
      // `licenseInfo != null` is a Definition-of-Done item for this sprint.
      expect(t).not.toMatch(/Copyright \(C\) 20\d\d(-20\d\d)? Ravi/);
      expect(t.split('\n').length).toBe(662);
      expect(createHash('sha256').update(t, 'utf8').digest('hex')).toBe(CANONICAL_AGPL_SHA256);
    });

    it('carries the copyright notice in README.md, where GNU gpl-howto puts it', () => {
      expect(read('README.md')).toMatch(/Copyright \(C\) 2025-2026 Ravi Chavali/);
    });
  });

  describe('prose claim sites', () => {
    it('covers every service on disk, not just the ones the registry happens to list', () => {
      // PROSE_SITES derives its service entries from the registry, so asserting a literal count
      // here would only restate that derivation. The load-bearing check is that the registry and
      // the filesystem agree — a service directory the registry forgot would otherwise ship
      // unlicensed, and the stray-claim scan cannot see it (it only fires on files that DO
      // mention a token, and a README with no License section mentions none).
      const onDisk = tracked('services/*/README.md')
        .filter((p) => /^services\/[^/]+\/README\.md$/.test(p)) // git's `*` crosses `/`
        .sort();

      expect(PROSE_SITES.filter((s) => s.file.startsWith('services/')).map((s) => s.file).sort())
        .toEqual(onDisk);
    });

    it('enumerates the six non-service sites explicitly, so scope cannot shrink', () => {
      expect(PROSE_SITES.filter((s) => !s.file.startsWith('services/')).map((s) => s.name)).toEqual([
        'README badge',
        'README license section',
        'CONTRIBUTING contributor agreement',
        'mobile README',
        'landing Footer',
        'landingContent manifesto copy',
      ]);
    });

    it('every site is readable AND agrees on one license family', () => {
      const results = PROSE_SITES.map((s) => ({
        name: s.name,
        family: normalizeLicense(s.extract(read(s.file))),
      }));

      // Unreadable is a FAILURE, not a skip: a claim that moved is exactly when the gate
      // must speak, and a silent null is how presence-checks fail open.
      expect(results.filter((r) => r.family === null).map((r) => r.name)).toEqual([]);

      expect([...new Set(results.map((r) => r.family))]).toEqual([EXPECTED_FAMILY]);
    });
  });

  describe('manifests', () => {
    it('every tracked manifest declares the exact SPDX id', () => {
      const manifests = tracked('*package.json');

      expect(manifests).toHaveLength(20); // identity, not a floor
      expect(manifests.filter((m) => JSON.parse(read(m)).license !== EXPECTED_SPDX)).toEqual([]);
    });
  });

  describe('no unenumerated claim site', () => {
    it('every file mentioning a license token is either an enumerated site or allowlisted', () => {
      const enumerated = new Set(PROSE_SITES.map((s) => s.file));

      const stray = filesMentioningALicense().filter(
        (p) => !enumerated.has(p) && !CLAIM_SCAN_ALLOWLIST.some((re) => re.test(p))
      );

      // A new license claim appeared. Reconcile it to AGPL-3.0-or-later and add it to
      // PROSE_SITES, or allowlist the path deliberately in CLAIM_SCAN_ALLOWLIST.
      expect(stray).toEqual([]);
    });
  });

  /**
   * A green gate proves nothing about a gate. Each extractor is exercised against a mutated
   * copy of its own real file and against an empty one, so every one of the sixteen is
   * separately shown to discriminate — not just whichever one a single injection happened to hit.
   */
  describe('each extractor is proven able to fail', () => {
    it.each(PROSE_SITES.map((s) => [s.name, s] as const))(
      '%s detects a flipped claim and an absent one',
      (_name, site) => {
        const flipped = read(site.file).replace(
          /AGPL--3\.0--or--later|AGPL-3\.0-or-later|AGPLv3/g,
          'MIT'
        );

        expect(normalizeLicense(site.extract(flipped))).toBe('MIT');
        expect(site.extract('')).toBeNull();
      }
    );

    it('the normalizer does not launder a foreign claim into agreement', () => {
      // services/simulation-service/README.md said "Internal use only - Karmyq Platform"
      // before this sprint — a license claim matching neither "MIT" nor "AGPL".
      expect(normalizeLicense('Internal use only - Karmyq Platform')).toBe('OTHER');
      expect(normalizeLicense('Apache-2.0')).toBe('OTHER');
      expect(normalizeLicense(null)).toBeNull();
      expect(normalizeLicense('')).toBeNull();
    });
  });
});
