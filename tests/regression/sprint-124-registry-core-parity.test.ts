import { readFileSync } from 'fs';
import { join } from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const core = require('../../scripts/lib/exemption-registry');

const ROOT = join(__dirname, '..', '..');
const NOW = new Date('2026-08-10T12:00:00Z');

type Entry = Record<string, string>;
type RegistrySpec = {
  collection: string;
  requiredFields: string[];
  identity: (entry: Entry) => string;
  fieldValidators: Record<string, (value: string, at: string) => string[]>;
  maxDays?: number;
  checkExpiry: (entry: Entry, ctx: { parseUtcDate: (value: string) => Date; today: Date }) => string[];
};

const auditSpec: RegistrySpec = {
  collection: 'exemptions',
  requiredFields: ['package', 'advisory', 'severity', 'rationale', 'decision', 'owner', 'created', 'expires'],
  identity: (entry: Entry) => `${entry.package}|${entry.advisory}`,
  fieldValidators: {
    advisory: (value: string, at: string) =>
      /^GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/.test(value)
        ? []
        : [`${at}: \"advisory\" must be an exact GHSA id (got \"${value}\")`],
    severity: (value: string, at: string) =>
      value === 'high'
        ? []
        : [`${at}: only \"high\" is exemptible — critical is never exemptible (got \"${value}\")`],
  },
  maxDays: 7,
  checkExpiry: (entry: Entry, ctx: { parseUtcDate: (value: string) => Date; today: Date }) => {
    const created = ctx.parseUtcDate(entry.created);
    const expires = ctx.parseUtcDate(entry.expires);
    if (Number.isNaN(expires.getTime())) {
      return [`\"expires\" must be a valid YYYY-MM-DD date (got \"${entry.expires}\")`];
    }
    if (Number.isNaN(created.getTime())) return [];

    const days = (expires.getTime() - created.getTime()) / 86400000;
    if (days <= 0) return ['\"expires\" must be after \"created\"'];
    if (days > 7) return ['exemption spans more than 7 days'];
    if (expires < ctx.today) return [`EXPIRED on ${entry.expires}`];
    return [];
  },
};

const expoSpec: RegistrySpec = {
  collection: 'divergences',
  requiredFields: ['package', 'declared', 'expoPins', 'sdk', 'rationale', 'decision', 'owner', 'created'],
  identity: (entry: Entry) => entry.package,
  fieldValidators: {
    sdk: (value: string, at: string) =>
      /^\d+$/.test(value) ? [] : [`${at}: \"sdk\" must be an SDK major`],
  },
  checkExpiry: () => [],
};

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
  sdk: '57',
  rationale: 'The project does not use the Expo Jest preset.',
  decision: 'Sprint 124, ADR-094',
  owner: 'ravichavali',
  created: '2026-08-10',
  ...overrides,
});

const specs = [
  { name: 'audit', spec: auditSpec, validEntry: validAuditEntry },
  { name: 'expo', spec: expoSpec, validEntry: validExpoEntry },
];

describe('Sprint 124 shared exemption registry core', () => {
  it('is spec-driven rather than audit-shaped', () => {
    const src = readFileSync(join(ROOT, 'scripts', 'lib', 'exemption-registry.js'), 'utf8');

    expect(core.validateRegistry).toEqual(expect.any(Function));
    // The core must NOT know what a GHSA id or a severity is.
    expect(src).not.toMatch(/GHSA/);
    expect(src).not.toMatch(/\bhigh\b|\bcritical\b/);
  });

  describe.each(specs)('$name registry shared invariants', ({ spec, validEntry }) => {
    const registry = (entries: unknown) => ({ [spec.collection]: entries });

    it.each([null, [], 'not an object'])('rejects a non-object registry: %p', (value) => {
      expect(core.validateRegistry(value, spec, NOW)).not.toEqual([]);
    });

    it('rejects a missing collection', () => {
      expect(core.validateRegistry({}, spec, NOW)).not.toEqual([]);
    });

    it.each([null, [], 'not an object'])('rejects a non-object entry: %p', (entry) => {
      expect(core.validateRegistry(registry([entry]), spec, NOW)).not.toEqual([]);
    });

    it.each(spec.requiredFields)('rejects a missing required field: %s', (field) => {
      const entry = validEntry();
      delete entry[field];

      expect(core.validateRegistry(registry([entry]), spec, NOW).join(' ')).toMatch(
        new RegExp(`\"${field}\" is required`)
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
      ).toMatch(/\"created\" must be a valid YYYY-MM-DD date/);
    });
  });

  it('keeps audit-only rules out of the Expo spec', () => {
    // The audit spec caps at 7 days; the Expo spec has no date window at all.
    expect(auditSpec.maxDays).toBe(7);
    expect(expoSpec.maxDays).toBeUndefined();

    // severity:'critical' is rejected under the audit spec, and 'severity' is not even
    // a field the Expo spec knows.
    expect(expoSpec.requiredFields).not.toContain('severity');
    expect(
      core
        .validateRegistry({ exemptions: [validAuditEntry({ severity: 'critical' })] }, auditSpec, NOW)
        .join(' ')
    ).toMatch(/critical is never exemptible/);
    expect(
      core.validateRegistry(
        { divergences: [validExpoEntry({ severity: 'critical' })] },
        expoSpec,
        NOW
      )
    ).toEqual([]);
  });
});
