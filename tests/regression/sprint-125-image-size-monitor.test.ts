import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Sprint 125 — the `image-size` upstream monitor.
 *
 * A monitor is worth exactly what its REFUSALS are worth. `scripts/check-image-size-upstream.js`
 * ran green against live upstream on 2026-08-17, and a green run proves nothing about whether the
 * thing can detect anything at all — the ADR-094 false-green lesson, restated.
 *
 * So every signal below is driven to fire from a synthetic upstream state, one condition at a
 * time, and the baseline is separately asserted to stay QUIET. `evaluate` is pure for exactly this
 * reason: no network, no fixtures to drift.
 *
 * The other half of this file guards the rule that matters most: the monitor must never be able to
 * renew the suppression it is monitoring.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const monitor = require('../../scripts/check-image-size-upstream');

const ROOT = join(__dirname, '..', '..');
const SCRIPT = join(ROOT, 'scripts', 'check-image-size-upstream.js');
const WORKFLOW = join(ROOT, '.github', 'workflows', 'image-size-advisory-watch.yml');

const ICNS = 'GHSA-w3rx-r6r6-pgpr';
const JXL = 'GHSA-5p2g-fcmc-qvqq';

/** "Today" for every horizon assertion, so these tests do not rot on a calendar boundary. */
const NOW = new Date('2026-08-13T00:00:00Z');

const advisory = (over: Record<string, unknown> = {}) => ({
  ghsa_id: ICNS,
  severity: 'high',
  withdrawn_at: null,
  vulnerabilities: [
    {
      package: { ecosystem: 'npm', name: 'image-size' },
      vulnerable_version_range: '<= 2.0.2',
      first_patched_version: null,
    },
  ],
  ...over,
});

const exemption = (over: Record<string, unknown> = {}) => ({
  package: 'image-size',
  advisory: ICNS,
  severity: 'high',
  rationale: 'x',
  decision: 'x',
  owner: 'ravichavali',
  created: '2026-08-11',
  // Far enough out that the baseline is quiet; individual horizon cases override it.
  expires: '2026-09-30',
  ...over,
});

/**
 * The world exactly as measured on 2026-08-17 — no fix, metro unmoved, tree vulnerable — but with
 * the exemption horizon pushed out so the horizon signal does not mask the case under test.
 */
const baseline = (over: Record<string, unknown> = {}) => ({
  latestVersion: '2.0.2',
  parentRange: '^1.0.2',
  parentVersion: '0.87.0',
  advisories: [advisory({ ghsa_id: ICNS }), advisory({ ghsa_id: JXL })],
  packageAdvisories: [advisory({ ghsa_id: ICNS }), advisory({ ghsa_id: JXL })],
  instances: [{ version: '1.2.1', path: 'root > expo > metro > image-size@1.2.1' }],
  exemptions: [exemption({ advisory: ICNS }), exemption({ advisory: JXL })],
  ...over,
});

const codes = (result: { signals: Array<{ code: string }> }) =>
  result.signals.map((signal) => signal.code);

describe('image-size monitor — the baseline must be quiet', () => {
  it('reports nothing actionable while upstream is unchanged and the horizon is far', () => {
    const result = monitor.evaluate(baseline(), NOW);

    // Asserting the exact signal list, not `.length === 0`: a future signal that fires on the
    // steady state would otherwise slip through as "still an array".
    expect(codes(result)).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('still records the measurements it took, so a quiet run is auditable', () => {
    const result = monitor.evaluate(baseline(), NOW);

    expect(result.facts.latestVersion).toBe('2.0.2');
    expect(result.facts.parentRange).toBe('^1.0.2');
    expect(result.facts.resolved).toHaveLength(1);
    expect(result.facts.advisories.map((a: any) => a.ghsa_id)).toEqual([ICNS, JXL]);
  });
});

describe('image-size monitor — every signal must be able to fire', () => {
  it('fires patched-release when an advisory gains a first_patched_version', () => {
    const patched = advisory({
      ghsa_id: ICNS,
      vulnerabilities: [
        {
          package: { ecosystem: 'npm', name: 'image-size' },
          vulnerable_version_range: '< 2.0.3',
          first_patched_version: '2.0.3',
        },
      ],
    });
    const result = monitor.evaluate(
      baseline({ advisories: [patched, advisory({ ghsa_id: JXL })] }),
      NOW
    );

    expect(codes(result)).toContain('patched-release');
    expect(result.ok).toBe(false);
    expect(result.signals.find((s: any) => s.code === 'patched-release').message).toContain('2.0.3');
  });

  it('fires advisory-withdrawn when GitHub withdraws an advisory', () => {
    const withdrawn = advisory({ ghsa_id: ICNS, withdrawn_at: '2026-08-14T00:00:00Z' });
    const result = monitor.evaluate(
      baseline({ advisories: [withdrawn, advisory({ ghsa_id: JXL })] }),
      NOW
    );

    expect(codes(result)).toContain('advisory-withdrawn');
    // A withdrawn advisory must NOT also be reported as having an upgrade path; it is simply gone.
    expect(codes(result)).not.toContain('patched-release');
    // ...and it must not make the OTHER, still-live advisory look resolved. `.every` treats a
    // `false` return as "the whole thing is false", so using false as the withdrawn-case value
    // fired a spurious parent-moved telling a human to go upgrade metro. Caught in code review;
    // the original withdrawn test asserted only patched-release, which is why it slipped through.
    expect(codes(result)).not.toContain('parent-moved');
  });

  it('fires latest-outside-range when a newer release escapes the vulnerable range', () => {
    const result = monitor.evaluate(baseline({ latestVersion: '2.1.0' }), NOW);

    expect(codes(result)).toContain('latest-outside-range');
    expect(result.ok).toBe(false);
  });

  it('fires new-advisory for an unexempted high that hits the resolved version', () => {
    const third = advisory({
      ghsa_id: 'GHSA-aaaa-bbbb-cccc',
      severity: 'high',
      vulnerabilities: [
        {
          package: { ecosystem: 'npm', name: 'image-size' },
          vulnerable_version_range: '<= 1.2.1',
          first_patched_version: null,
        },
      ],
    });
    const result = monitor.evaluate(
      baseline({
        packageAdvisories: [advisory({ ghsa_id: ICNS }), advisory({ ghsa_id: JXL }), third],
      }),
      NOW
    );

    expect(codes(result)).toContain('new-advisory');
  });

  it('does NOT fire new-advisory for an advisory that misses the resolved version', () => {
    const irrelevant = advisory({
      ghsa_id: 'GHSA-dddd-eeee-ffff',
      severity: 'high',
      vulnerabilities: [
        {
          package: { ecosystem: 'npm', name: 'image-size' },
          vulnerable_version_range: '>= 2.0.0',
          first_patched_version: null,
        },
      ],
    });
    const result = monitor.evaluate(
      baseline({
        packageAdvisories: [advisory({ ghsa_id: ICNS }), advisory({ ghsa_id: JXL }), irrelevant],
      }),
      NOW
    );

    expect(codes(result)).not.toContain('new-advisory');
  });

  it('ignores a moderate unexempted advisory — only high/critical block the gate', () => {
    const moderate = advisory({
      ghsa_id: 'GHSA-1111-2222-3333',
      severity: 'moderate',
      vulnerabilities: [
        {
          package: { ecosystem: 'npm', name: 'image-size' },
          vulnerable_version_range: '<= 1.2.1',
          first_patched_version: null,
        },
      ],
    });
    const result = monitor.evaluate(
      baseline({
        packageAdvisories: [advisory({ ghsa_id: ICNS }), advisory({ ghsa_id: JXL }), moderate],
      }),
      NOW
    );

    expect(codes(result)).not.toContain('new-advisory');
  });

  it('fires parent-dropped-dep when metro stops declaring image-size', () => {
    const result = monitor.evaluate(baseline({ parentRange: undefined }), NOW);

    expect(codes(result)).toContain('parent-dropped-dep');
  });

  it('fires parent-moved when metro can resolve to a version outside the ranges', () => {
    // metro widened to ^2.1.0 while the newest release (2.1.0) sits outside `<= 2.0.2`.
    const result = monitor.evaluate(
      baseline({ parentRange: '^2.1.0', latestVersion: '2.1.0' }),
      NOW
    );

    expect(codes(result)).toContain('parent-moved');
  });

  it('fires tree-clean when image-size leaves the resolved tree entirely', () => {
    const result = monitor.evaluate(baseline({ instances: [] }), NOW);

    expect(codes(result)).toContain('tree-clean');
  });

  it('fires tree-not-vulnerable when the resolved version escapes every live range', () => {
    const result = monitor.evaluate(
      baseline({ instances: [{ version: '3.0.0', path: 'root > image-size@3.0.0' }] }),
      NOW
    );

    expect(codes(result)).toContain('tree-not-vulnerable');
  });

  it('fires horizon-approaching inside the warning window', () => {
    const result = monitor.evaluate(
      baseline({ exemptions: [exemption({ advisory: ICNS, expires: '2026-08-18' })] }),
      NOW
    );

    const signal = result.signals.find((s: any) => s.code === 'horizon-approaching');
    expect(signal).toBeDefined();
    // `expires` is the first INVALID day, so 08-13 -> 08-18 is 5 days of remaining suppression.
    expect(signal.message).toContain('5 day(s) left');
  });

  it('fires horizon-expired once the exemption has lapsed', () => {
    const result = monitor.evaluate(
      baseline({ exemptions: [exemption({ advisory: ICNS, expires: '2026-08-12' })] }),
      NOW
    );

    expect(codes(result)).toContain('horizon-expired');
    expect(codes(result)).not.toContain('horizon-approaching');
  });

  it('treats `expires` as the first invalid day, matching the audit gate', () => {
    // Same-day expiry is EXPIRED, not "approaching" — scripts/audit-exemptions.js uses `<=`.
    const result = monitor.evaluate(
      baseline({ exemptions: [exemption({ advisory: ICNS, expires: '2026-08-13' })] }),
      NOW
    );

    expect(codes(result)).toContain('horizon-expired');
  });
});

describe('image-size monitor — the post-remediation success state', () => {
  const remediated = () =>
    baseline({
      exemptions: [],
      advisories: [],
      instances: [],
    });

  it('goes quiet once the exemptions are deleted and the package is gone', () => {
    const result = monitor.evaluate(remediated(), NOW);

    // The monitor must not go permanently red at the moment its problem is solved.
    expect(codes(result)).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('still fires if the exemptions are deleted while the tree stays vulnerable', () => {
    // This is the ADR-059 gate actively blocking every PR — the loudest possible state.
    const result = monitor.evaluate(
      baseline({ exemptions: [], advisories: [] }),
      NOW
    );

    expect(codes(result)).toContain('new-advisory');
    expect(result.ok).toBe(false);
  });
});

describe('image-size monitor — it must never renew its own suppression', () => {
  const script = readFileSync(SCRIPT, 'utf8');
  const workflow = readFileSync(WORKFLOW, 'utf8');

  it('the script contains no write path to the exemption registry', () => {
    // Any fs write API at all. The script legitimately READS the registry; it must never write it.
    const writeApis = /\b(writeFileSync|writeFile|appendFileSync|appendFile|createWriteStream|rmSync|unlinkSync|renameSync|openSync)\b/g;
    expect(script.match(writeApis)).toBeNull();
  });

  it('the workflow never triggers on pull_request', () => {
    // A registry-reachability dependency on the merge path is exactly what expo-sdk-drift avoided.
    const onBlock = workflow.slice(workflow.indexOf('\non:'), workflow.indexOf('\nconcurrency:'));
    expect(onBlock).not.toMatch(/pull_request/);
    expect(onBlock).toMatch(/schedule:/);
    expect(onBlock).toMatch(/workflow_dispatch:/);
  });

  it('the workflow grants only read access to repository contents', () => {
    expect(workflow).toMatch(/permissions:\s*\n\s*contents:\s*read\s*\n\s*issues:\s*write/);
    expect(workflow).not.toMatch(/contents:\s*write/);
  });

  it('the workflow mentions the registry only in comments and issue prose, never a command', () => {
    const offending = workflow
      .split('\n')
      .filter((line) => /audit-exemptions\.json/.test(line))
      .filter((line) => {
        const trimmed = line.trim();
        // Allowed: YAML comments, and the issue-body prose lines (which are inside a heredoc and
        // are markdown list items / warnings, never shell redirections into the file).
        return !trimmed.startsWith('#') && /(^|\s)(>|>>|tee|sed -i|cat\s*>)/.test(trimmed);
      });
    expect(offending).toEqual([]);
  });
});

describe('the cap is only defensible while the monitor covers the registry', () => {
  /*
   * Sprint 125 raised MAX_EXEMPTION_DAYS from 7 to 30, and ADR-059 justifies that ENTIRELY on the
   * grounds that the weekly monitor took over the re-measurement obligation. That argument is only
   * true for packages the monitor actually watches.
   *
   * Without this test the invariant lives in a paragraph: exempt a second package tomorrow and it
   * silently inherits a 30-day suppression with no monitoring at all — worse than the 7-day world
   * it replaced. This turns that from a latent regression into a build failure on the day it
   * matters, which is the difference between a documented intention and an enforced one.
   */
  const registry = JSON.parse(readFileSync(join(ROOT, 'security', 'audit-exemptions.json'), 'utf8'));
  const exemptedPackages = [
    ...new Set((registry.exemptions ?? []).map((e: { package: string }) => e.package)),
  ];

  it('every exempted package is in the monitor watch set', () => {
    const unwatched = exemptedPackages.filter((p) => !monitor.WATCHED_PACKAGES.includes(p));

    expect(unwatched).toEqual([]);
  });

  it('the watch set is not empty while exemptions exist', () => {
    // Guards the degenerate pass: an empty registry AND an empty watch set would satisfy the check
    // above vacuously.
    if (exemptedPackages.length > 0) {
      expect(monitor.WATCHED_PACKAGES.length).toBeGreaterThan(0);
    }
  });

  it('detects an unwatched package rather than passing on the happy path', () => {
    // Proves the check above can fail — the assertion, applied to a registry that HAS an unwatched
    // package, must report it.
    const hypothetical = ['image-size', 'some-newly-exempted-package'];
    const unwatched = hypothetical.filter((p) => !monitor.WATCHED_PACKAGES.includes(p));

    expect(unwatched).toEqual(['some-newly-exempted-package']);
  });
});
