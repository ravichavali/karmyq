import { execFileSync } from 'child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

/**
 * Sprint 123 — the ADR-059 time-boxed exemption mechanism.
 *
 * The gate this replaces was binary: `image-size` has no published fix (latest 2.0.2 is inside the
 * advisory range, metro@0.87.0 still declares ^1.0.2, and 2.x drops the default export metro
 * requires), so it blocked every PR indefinitely. The tempting "fixes" — dropping to
 * --audit-level=critical, or --no-verify — surrender the entire gate.
 *
 * A gate with an exemption list is only as good as its refusals, and a green run cannot tell a
 * working gate from an inert one. So almost every case below asserts a RED: expired, over-long,
 * malformed, wrong severity, wrong id, stale, and partially-exempted parents must all still fail.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const gate = require('../../scripts/audit-exemptions');

const ROOT = join(__dirname, '..', '..');
const REGISTRY = join(ROOT, 'security', 'audit-exemptions.json');

const IMAGE_SIZE_ICNS = 'GHSA-w3rx-r6r6-pgpr';
const IMAGE_SIZE_JXL = 'GHSA-5p2g-fcmc-qvqq';

/** A well-formed exemption, minus whatever the case under test wants to break. */
const validExemption = (over: Record<string, unknown> = {}) => ({
  package: 'image-size',
  advisory: IMAGE_SIZE_ICNS,
  severity: 'high',
  rationale: 'No fixed version exists upstream.',
  decision: 'PR #198 code review',
  owner: 'ravichavali',
  created: '2026-08-10',
  expires: '2026-08-17',
  ...over,
});

const NOW = new Date('2026-08-10T12:00:00Z');

/** Minimal `npm audit --json` shaped report. */
const advisory = (url: string, severity = 'high', title = 't') => ({
  source: 1,
  url: `https://github.com/advisories/${url}`,
  title,
  severity,
  range: '<=2.0.2',
});

const reportWithImageSize = () => ({
  vulnerabilities: {
    'image-size': {
      name: 'image-size',
      severity: 'high',
      via: [advisory(IMAGE_SIZE_ICNS), advisory(IMAGE_SIZE_JXL)],
    },
    metro: { name: 'metro', severity: 'high', via: ['image-size'] },
  },
});

describe('ADR-059 exemption registry — the shipped file is valid', () => {
  it('parses, and satisfies its own schema and expiry rules TODAY', () => {
    // Deliberately uses the real clock: an expired exemption must break the build on the day it
    // expires, without anyone remembering to come back. That is the entire point of the expiry.
    const registry = JSON.parse(readFileSync(REGISTRY, 'utf8'));
    expect(gate.validateRegistry(registry, new Date())).toEqual([]);
  });

  it('exempts only high severity, with exact GHSA ids and no wildcards', () => {
    const registry = JSON.parse(readFileSync(REGISTRY, 'utf8'));
    for (const e of registry.exemptions) {
      expect(e.severity).toBe('high');
      expect(e.advisory).toMatch(/^GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/);
      expect(e.package).not.toMatch(/[*?]/);
      expect(e.rationale.length).toBeGreaterThan(40);
    }
  });

  it('every shipped exemption still matches a LIVE advisory (catches a typo or a fixed upstream)', () => {
    // If image-size ships a fix, this is what turns red and forces the exemption to be deleted
    // rather than quietly outliving its reason.
    const report = gate.runAudit(ROOT);
    const live = new Set<string>();
    for (const name of Object.keys(report.vulnerabilities ?? {})) {
      for (const [, a] of gate.reachableAdvisories(report.vulnerabilities, name)) {
        live.add(`${a.package}|${a.advisory}`);
      }
    }
    const registry = JSON.parse(readFileSync(REGISTRY, 'utf8'));
    for (const e of registry.exemptions) {
      expect(live.has(`${e.package}|${e.advisory}`)).toBe(true);
    }
  });
});

describe('ADR-059 gate — proves it can actually FAIL', () => {
  it('BLOCKS an unexempted high', () => {
    const r = gate.evaluateAudit(reportWithImageSize(), { exemptions: [] }, NOW);
    expect(r.ok).toBe(false);
    expect(r.blocking.map((b: { package: string }) => b.package).sort()).toEqual([
      'image-size',
      'metro',
    ]);
  });

  it('BLOCKS a critical even when the registry lists it', () => {
    const report = {
      vulnerabilities: {
        'image-size': {
          name: 'image-size',
          severity: 'critical',
          via: [advisory(IMAGE_SIZE_ICNS, 'critical')],
        },
      },
    };
    // Registry validation rejects severity:"critical" outright...
    const declared = gate.evaluateAudit(
      report,
      { exemptions: [validExemption({ severity: 'critical' })] },
      NOW
    );
    expect(declared.ok).toBe(false);
    expect(declared.errors.join(' ')).toMatch(/critical is never exemptible/);

    // ...and even a well-formed "high" exemption cannot clear an advisory the report calls critical.
    const smuggled = gate.evaluateAudit(report, { exemptions: [validExemption()] }, NOW);
    expect(smuggled.ok).toBe(false);
    expect(smuggled.blocking).toHaveLength(1);
  });

  it('BLOCKS an EXPIRED exemption', () => {
    const r = gate.evaluateAudit(
      reportWithImageSize(),
      { exemptions: [validExemption({ created: '2026-08-01', expires: '2026-08-08' })] },
      NOW
    );
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/EXPIRED on 2026-08-08/);
  });

  it('BLOCKS an exemption longer than 7 days', () => {
    const r = gate.evaluateAudit(
      reportWithImageSize(),
      { exemptions: [validExemption({ created: '2026-08-10', expires: '2026-08-18' })] },
      NOW
    );
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/spans 8 days — the maximum is 7/);
  });

  it.each(['package', 'advisory', 'rationale', 'decision', 'owner', 'created', 'expires'])(
    'BLOCKS when required field "%s" is missing',
    (field) => {
      const e = validExemption();
      delete (e as Record<string, unknown>)[field];
      const r = gate.evaluateAudit(reportWithImageSize(), { exemptions: [e] }, NOW);
      expect(r.ok).toBe(false);
      expect(r.errors.join(' ')).toMatch(new RegExp(`"${field}" is required`));
    }
  );

  it('BLOCKS a non-GHSA advisory id — no package-wide wildcard', () => {
    for (const bad of ['*', 'image-size', '1138808', 'GHSA-nope']) {
      const r = gate.evaluateAudit(
        reportWithImageSize(),
        { exemptions: [validExemption({ advisory: bad })] },
        NOW
      );
      expect(r.ok).toBe(false);
      expect(r.errors.join(' ')).toMatch(/must be an exact GHSA id/);
    }
  });

  it('BLOCKS an impossible or malformed date', () => {
    for (const bad of ['2026-02-31', '10-08-2026', 'soon', '']) {
      const r = gate.evaluateAudit(
        reportWithImageSize(),
        { exemptions: [validExemption({ expires: bad })] },
        NOW
      );
      expect(r.ok).toBe(false);
    }
  });

  it('BLOCKS when expiry precedes creation', () => {
    const r = gate.evaluateAudit(
      reportWithImageSize(),
      { exemptions: [validExemption({ created: '2026-08-10', expires: '2026-08-09' })] },
      NOW
    );
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/must be after "created"/);
  });

  it('BLOCKS a duplicate exemption', () => {
    const r = gate.evaluateAudit(
      reportWithImageSize(),
      { exemptions: [validExemption(), validExemption()] },
      NOW
    );
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/duplicate exemption/);
  });

  it('BLOCKS a STALE exemption that matches nothing (upstream shipped a fix)', () => {
    const r = gate.evaluateAudit(
      { vulnerabilities: {} },
      { exemptions: [validExemption()] },
      NOW
    );
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/matches no current advisory/);
  });

  it('BLOCKS a NEW advisory on an already-exempted package', () => {
    // The exact-id rule earning its keep: image-size is exempted for two advisories; a third
    // must still stop the build.
    const report = reportWithImageSize();
    report.vulnerabilities['image-size'].via.push(advisory('GHSA-aaaa-bbbb-cccc'));

    const r = gate.evaluateAudit(
      report,
      {
        exemptions: [
          validExemption(),
          validExemption({ advisory: IMAGE_SIZE_JXL }),
        ],
      },
      NOW
    );
    expect(r.ok).toBe(false);
    expect(r.blocking.map((b: { package: string }) => b.package).sort()).toEqual([
      'image-size',
      'metro',
    ]);
  });

  it('BLOCKS a parent that also has an advisory of its OWN', () => {
    // "Cleared only when every reachable advisory is exempted." metro is currently high solely
    // because of image-size; the day metro gains its own finding it must block again.
    const report = reportWithImageSize();
    (report.vulnerabilities.metro.via as unknown[]).push(advisory('GHSA-dddd-eeee-ffff'));

    const r = gate.evaluateAudit(
      report,
      { exemptions: [validExemption(), validExemption({ advisory: IMAGE_SIZE_JXL })] },
      NOW
    );
    expect(r.ok).toBe(false);
    expect(r.blocking).toHaveLength(1);
    expect(r.blocking[0].package).toBe('metro');
    expect(r.cleared.map((c: { package: string }) => c.package)).toEqual(['image-size']);
  });

  it('BLOCKS rather than guesses when no advisory resolves', () => {
    const r = gate.evaluateAudit(
      { vulnerabilities: { mystery: { name: 'mystery', severity: 'high', via: [] } } },
      { exemptions: [] },
      NOW
    );
    expect(r.ok).toBe(false);
    expect(r.blocking[0].reason).toBe('no advisory resolved');
  });
});

describe('ADR-059 gate — clears exactly what it should', () => {
  it('clears the image-size chain when both advisories are exempted', () => {
    const r = gate.evaluateAudit(
      reportWithImageSize(),
      { exemptions: [validExemption(), validExemption({ advisory: IMAGE_SIZE_JXL })] },
      NOW
    );
    expect(r.ok).toBe(true);
    expect(r.blocking).toEqual([]);
    expect(r.cleared.map((c: { package: string }) => c.package).sort()).toEqual([
      'image-size',
      'metro',
    ]);
  });

  it('ignores moderate and low findings entirely (the gate blocks at high)', () => {
    const r = gate.evaluateAudit(
      {
        vulnerabilities: {
          lodash: { name: 'lodash', severity: 'moderate', via: [advisory('GHSA-1111-2222-3333', 'moderate')] },
        },
      },
      { exemptions: [] },
      NOW
    );
    expect(r.ok).toBe(true);
  });

  it('terminates on a cyclic via graph instead of hanging', () => {
    // metro <-> metro-config <-> metro-transform-worker genuinely reference each other in the
    // real report; a naive recursive walk stack-overflows here.
    const r = gate.evaluateAudit(
      {
        vulnerabilities: {
          a: { name: 'a', severity: 'high', via: ['b'] },
          b: { name: 'b', severity: 'high', via: ['a', advisory(IMAGE_SIZE_ICNS)] },
        },
      },
      { exemptions: [validExemption({ package: 'b' })] },
      NOW
    );
    expect(r.ok).toBe(true);
    expect(r.cleared.map((c: { package: string }) => c.package).sort()).toEqual(['a', 'b']);
  });
});

describe('ADR-059 gate — CI and the test tier share ONE registry', () => {
  it('ci.yml invokes the shared script rather than a bare npm audit', () => {
    const ci = readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf8');
    expect(ci).toMatch(/scripts\/audit-exemptions\.js/);
    // The bare command would ignore the registry and red on the exempted advisory.
    expect(ci).not.toMatch(/npm audit --package-lock-only --audit-level=high/);
  });

  it('the CLI EXITS NON-ZERO against the live audit with an empty registry', () => {
    // Proves the executable path, not just the exported function: an evaluator returning ok:false
    // while the CLI exits 0 would be a silently inert gate. Points the real script at an empty
    // registry, so the live image-size highs must block.
    const empty = join(mkdtempSync(join(tmpdir(), 'karmyq-audit-')), 'empty.json');
    writeFileSync(empty, JSON.stringify({ exemptions: [] }));

    let status = 0;
    let out = '';
    try {
      execFileSync(process.execPath, [join(ROOT, 'scripts/audit-exemptions.js')], {
        cwd: ROOT,
        encoding: 'utf8',
        env: { ...process.env, KARMYQ_AUDIT_REGISTRY: empty },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err) {
      const e = err as { status?: number; stdout?: string; stderr?: string };
      status = e.status ?? 1;
      out = `${e.stdout ?? ''}${e.stderr ?? ''}`;
    }

    expect(status).toBe(1);
    expect(out).toMatch(/BLOCKING \(high\): image-size/);
    expect(out).toMatch(/ADR-059 gate FAILED/);
  });

  it('the CLI exits ZERO with the shipped registry', () => {
    const out = execFileSync(process.execPath, [join(ROOT, 'scripts/audit-exemptions.js')], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    expect(out).toMatch(/ADR-059 gate clean/);
  });
});