import { readFileSync } from 'fs';
import { join } from 'path';

/* eslint-disable @typescript-eslint/no-var-requires */
const core = require('../../scripts/lib/exemption-registry');
// The REAL specs, imported from the scripts that ship them. Re-declaring spec literals here would
// make every assertion below tautological — it would prove only that a local object matches itself,
// and would stay green while the shipped specs drifted underneath it.
const { AUDIT_SPEC, MAX_EXEMPTION_DAYS } = require('../../scripts/audit-exemptions');
const { expoSpec, currentSdkMajor } = require('../../scripts/expo-divergences');
/* eslint-enable @typescript-eslint/no-var-requires */

const ROOT = join(__dirname, '..', '..');
const NOW = new Date('2026-08-10T12:00:00Z');

type Entry = Record<string, string>;

const mobilePkg = JSON.parse(
  readFileSync(join(ROOT, 'apps', 'mobile', 'package.json'), 'utf8')
);
const EXPO_SPEC = expoSpec(mobilePkg);
const LIVE_SDK = currentSdkMajor(mobilePkg);

const validAuditEntry = (overrides: Partial<Entry> = {}): Entry => ({
  package: 'image-size',
  advisory: 'GHSA-w3rx-r6r6-pgpr',
  severity: 'high',
  rationale: 'No fixed version exists upstream.',
  decision: 'Sprint 124, ADR-094',
  owner: 'ravichavali',
  created: '2026-08-10',
  expires: '2026-08-17',
  ...overrides,
});

const validExpoEntry = (overrides: Partial<Entry> = {}): Entry => ({
  package: 'jest',
  declared: '^30.4.2',
  expoPins: '~29.7.0',
  sdk: LIVE_SDK,
  rationale: 'The project does not use the Expo Jest preset.',
  decision: 'Sprint 124, ADR-094',
  owner: 'ravichavali',
  created: '2026-08-10',
  ...overrides,
});

type RegistrySpec = { collection: string; requiredFields: string[] };

const specs: { name: string; spec: RegistrySpec; validEntry: (o?: Partial<Entry>) => Entry }[] = [
  { name: 'audit', spec: AUDIT_SPEC, validEntry: validAuditEntry },
  { name: 'expo', spec: EXPO_SPEC, validEntry: validExpoEntry },
];

describe('Sprint 124 shared exemption registry core', () => {
  it('is spec-driven rather than audit-shaped', () => {
    const src = readFileSync(join(ROOT, 'scripts', 'lib', 'exemption-registry.js'), 'utf8');

    expect(core.validateRegistry).toEqual(expect.any(Function));
    // The core must NOT know what a GHSA id or a severity is.
    expect(src).not.toMatch(/GHSA/);
    expect(src).not.toMatch(/\bhigh\b|\bcritical\b/);
  });

  it('drives both shipped registries through the one core', () => {
    // Guards the premise of every table-driven case below: these must be the shipped specs, and
    // they must be genuinely different registries rather than the same object imported twice.
    expect(AUDIT_SPEC.collection).toBe('exemptions');
    expect(EXPO_SPEC.collection).toBe('divergences');

    // Pinned by identity, not by count. The per-field rejection cases below are generated FROM
    // these lists, so without this assertion dropping a required field would silently delete its
    // own test case instead of failing anything.
    expect(AUDIT_SPEC.requiredFields).toEqual([
      'package',
      'advisory',
      'severity',
      'rationale',
      'decision',
      'owner',
      'created',
      'expires',
    ]);
    expect(EXPO_SPEC.requiredFields).toEqual([
      'package',
      'declared',
      'expoPins',
      'sdk',
      'rationale',
      'decision',
      'owner',
      'created',
    ]);

    // Each shipped registry file validates clean under its own shipped spec.
    const auditRegistry = JSON.parse(
      readFileSync(join(ROOT, 'security', 'audit-exemptions.json'), 'utf8')
    );
    const expoRegistry = JSON.parse(
      readFileSync(join(ROOT, 'security', 'expo-divergences.json'), 'utf8')
    );
    expect(core.validateRegistry(expoRegistry, EXPO_SPEC, NOW)).toEqual([]);
    // The audit registry is time-boxed, so it is checked for structure at its own creation date.
    expect(
      core.validateRegistry(auditRegistry, AUDIT_SPEC, new Date(`${auditRegistry.exemptions[0].created}T12:00:00Z`))
    ).toEqual([]);
  });

  describe.each(specs)('$name registry shared invariants', ({ spec, validEntry }) => {
    const registry = (entries: unknown) => ({ [spec.collection]: entries });

    it('accepts a valid entry, so every rejection below is caused by the injected defect', () => {
      expect(core.validateRegistry(registry([validEntry()]), spec, NOW)).toEqual([]);
    });

    it.each([null, [], 'not an object'])('rejects a non-object registry: %p', (value) => {
      expect(core.validateRegistry(value, spec, NOW)).not.toEqual([]);
    });

    it('rejects a missing collection', () => {
      expect(core.validateRegistry({}, spec, NOW)).not.toEqual([]);
    });

    it.each([null, [], 'not an object'])('rejects a non-object entry: %p', (entry) => {
      expect(core.validateRegistry(registry([entry]), spec, NOW)).not.toEqual([]);
    });

    it.each(spec.requiredFields)('rejects a missing required field: %s', (field: string) => {
      const entry = validEntry();
      delete entry[field];

      expect(core.validateRegistry(registry([entry]), spec, NOW).join(' ')).toMatch(
        new RegExp(`"${field}" is required`)
      );
    });

    it('rejects a duplicate identity', () => {
      expect(core.validateRegistry(registry([validEntry(), validEntry()]), spec, NOW).join(' ')).toMatch(
        /duplicate/
      );
    });

    it.each(['not-a-date', '2026-02-31'])('rejects an invalid created date: %s', (created) => {
      expect(
        core.validateRegistry(registry([validEntry({ created })]), spec, NOW).join(' ')
      ).toMatch(/"created" must be a valid YYYY-MM-DD date/);
    });
  });

  describe('the firewall — sharing a core is not sharing rules', () => {
    it('enforces the ADR-059 day cap under the audit spec only', () => {
      const overLongSpan = validAuditEntry({
        created: '2026-08-10',
        expires: '2026-08-20', // 10 days — over the 7-day cap
      });
      expect(
        core.validateRegistry({ exemptions: [overLongSpan] }, AUDIT_SPEC, NOW).join(' ')
      ).toMatch(new RegExp(`the maximum is ${MAX_EXEMPTION_DAYS}`));

      // The Expo spec has no date window at all: an entry carrying the same over-long span is
      // clean, because a divergence expires by SDK generation, never by elapsed days.
      expect(
        core.validateRegistry(
          { divergences: [validExpoEntry({ created: '2026-08-10', expires: '2026-08-20' })] },
          EXPO_SPEC,
          NOW
        )
      ).toEqual([]);
    });

    it('caps how long an exemption stays LIVE, not merely how long it spans', () => {
      // A future `created` keeps the span inside the cap while suppressing the advisory from today
      // right through to a far-future `expires`. Found by /security-review on this branch: the
      // entry below spans exactly 7 days and validated clean while suppressing a high for 149.
      // "spans <= 7 days" is not the ADR-059 SLA; "resolved within a week" is.
      const futureDated = validAuditEntry({
        created: '2027-01-01',
        expires: '2027-01-08',
      });

      expect(
        core.validateRegistry({ exemptions: [futureDated] }, AUDIT_SPEC, NOW).join(' ')
      ).toMatch(/"created" must not be in the future/);
    });

    it('rejects critical under the audit spec, and does not know severity under the Expo spec', () => {
      expect(EXPO_SPEC.requiredFields).not.toContain('severity');
      expect(
        core
          .validateRegistry({ exemptions: [validAuditEntry({ severity: 'critical' })] }, AUDIT_SPEC, NOW)
          .join(' ')
      ).toMatch(/critical is never exemptible/);
      expect(
        core.validateRegistry(
          { divergences: [validExpoEntry({ severity: 'critical' })] },
          EXPO_SPEC,
          NOW
        )
      ).toEqual([]);
    });

    it('expires an Expo divergence by SDK generation, a rule the audit spec does not have', () => {
      const pastGeneration = String(Number(LIVE_SDK) - 1);
      expect(
        core
          .validateRegistry({ divergences: [validExpoEntry({ sdk: pastGeneration })] }, EXPO_SPEC, NOW)
          .join(' ')
      ).toMatch(new RegExp(`EXPIRED with SDK ${pastGeneration}`));

      // The audit spec has no notion of an SDK generation, so an `sdk` field is inert there.
      expect(
        core.validateRegistry(
          { exemptions: [validAuditEntry({ sdk: pastGeneration })] },
          AUDIT_SPEC,
          NOW
        )
      ).toEqual([]);
    });
  });
});
