import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { spawnSync } from 'child_process';

const ROOT = join(__dirname, '..', '..');
const SCRIPT = join(ROOT, 'scripts', 'expo-divergences.js');
const FIXTURES = join(__dirname, 'fixtures');
const REAL_EXPO_OUTPUT = readFileSync(join(FIXTURES, 'expo-check-drift.txt'), 'utf8');

type Drift = {
  package: string;
  installed: string;
  expoPins: string;
};

type Divergence = Record<string, string>;
type Registry = { divergences: Divergence[] };
type CheckResult = {
  status: number | null;
  signal?: string | null;
  output: string;
};
type Evaluation = {
  ok: boolean;
  errors: string[];
  blocking: Drift[];
  cleared: Divergence[];
  stale: Divergence[];
  mismatched: Divergence[];
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const gate = require('../../scripts/expo-divergences') as {
  parseExpoCheckOutput: (output: string) => Drift[];
  evaluate: (checkResult: CheckResult, registry: unknown) => Evaluation;
  readRegistry: (file?: string) => Registry;
  runExpoCheck: () => CheckResult;
  expoSpec: (mobilePkg: unknown) => { requiredFields: string[] };
};

// Read from the shipped spec, not re-declared here: the per-field rejection cases below are
// generated from this list, so a hand-written copy would silently delete a field's own test case
// when that field was dropped. The literal below pins it by identity so the deletion fails loudly.
const REQUIRED_FIELDS = gate.expoSpec(
  JSON.parse(readFileSync(join(ROOT, 'apps', 'mobile', 'package.json'), 'utf8'))
).requiredFields;

it('pins the shipped divergence schema', () => {
  expect(REQUIRED_FIELDS).toEqual([
    'package',
    'declared',
    'expoPins',
    'sdk',
    'rationale',
    'decision',
    'owner',
    'created',
  ]);
});

const driftOutput = (...lines: string[]): string => [
  'The following packages should be updated for best compatibility with the installed expo version:',
  ...lines.map((line) => `  ${line}`),
  'Your project may not work correctly until you install the expected versions of the packages.',
  'Found outdated dependencies',
].join('\n');

const jestDrift = driftOutput('jest@30.4.2 - expected version: ~29.7.0');
const bothJestDrifts = driftOutput(
  '@types/jest@30.0.0 - expected version: 29.5.14',
  'jest@30.4.2 - expected version: ~29.7.0'
);

const validEntry = (overrides: Divergence = {}): Divergence => ({
  package: 'jest',
  declared: '^30.4.2',
  expoPins: '~29.7.0',
  sdk: '57',
  rationale: 'apps/mobile does not use the Expo Jest preset.',
  decision: 'Sprint 124, ADR-094',
  owner: 'ravichavali',
  created: '2026-08-11',
  ...overrides,
});

const validRegistry = (): Registry => ({
  divergences: [
    validEntry(),
    validEntry({
      package: '@types/jest',
      declared: '^30.0.0',
      expoPins: '29.5.14',
      rationale: 'Types for the deliberately divergent Jest version.',
    }),
  ],
});

const fixtureRegistry = (name: string): Registry =>
  JSON.parse(readFileSync(join(FIXTURES, name), 'utf8')) as Registry;

describe('Sprint 124 Expo divergence gate', () => {
  it('parses every drift from the real Expo output with its exact installed and expected versions', () => {
    expect(gate.parseExpoCheckOutput(REAL_EXPO_OUTPUT)).toEqual([
      { package: '@expo/metro-runtime', installed: '57.0.8', expoPins: '~57.0.9' },
      { package: 'expo', installed: '57.0.10', expoPins: '~57.0.12' },
      { package: 'expo-constants', installed: '57.0.9', expoPins: '~57.0.10' },
      { package: 'expo-image-picker', installed: '57.0.7', expoPins: '~57.0.9' },
      { package: 'expo-location', installed: '57.0.7', expoPins: '~57.0.9' },
      { package: 'expo-notifications', installed: '57.0.8', expoPins: '~57.0.10' },
      { package: 'expo-router', installed: '57.0.10', expoPins: '~57.0.12' },
      { package: 'expo-splash-screen', installed: '57.0.5', expoPins: '~57.0.6' },
      { package: '@types/jest', installed: '30.0.0', expoPins: '29.5.14' },
      { package: 'jest', installed: '30.4.2', expoPins: '~29.7.0' },
    ]);
  });

  it('fails closed when Expo exits non-zero in an unrecognized future output format', () => {
    // A non-zero exit whose output parses to zero packages means "I could not tell",
    // and must BLOCK. Treating it as clean repeats the ADR-060 fail-open defect.
    const result = gate.evaluate(
      { status: 1, output: 'some unrecognized future format' },
      { divergences: [] }
    );

    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/parse|recogniz|determine/i);
  });

  it('fails closed when one row inside the Expo drift block changes format', () => {
    const result = gate.evaluate(
      {
        status: 1,
        output: driftOutput(
          '@types/jest@30.0.0 - expected version: 29.5.14',
          'jest@30.4.2 - expected version: ~29.7.0',
          'expo-camera@57.0.3 -> expected ~57.0.4'
        ),
      },
      validRegistry()
    );

    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/parse|malformed|recogniz/i);
    expect(result.errors.join(' ')).toMatch(/expo-camera/i);
  });

  it.each([
    [
      'header and footer',
      ['  @types/jest@30.0.0 - expected version: 29.5.14', '  jest@30.4.2 - expected version: ~29.7.0'].join('\n'),
    ],
    ['final footer', bothJestDrifts.replace('\nFound outdated dependencies', '')],
  ])('rejects recognized drift rows without the known Expo %s framing', (_part, output) => {
    const result = gate.evaluate({ status: 1, output }, validRegistry());

    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/fram|footer|recogniz|complete/i);
  });

  it('rejects nonblank content after the final Expo drift footer', () => {
    const result = gate.evaluate(
      { status: 1, output: `${bothJestDrifts}\n  expo-camera@57.0.3 -> expected ~57.0.4` },
      validRegistry()
    );

    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/after|footer|trailing|complete/i);
    expect(result.errors.join(' ')).toMatch(/expo-camera/i);
  });

  it('rejects registered drift emitted with an unexpected Expo exit status', () => {
    const result = gate.evaluate({ status: 2, output: bothJestDrifts }, validRegistry());

    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/status 2|exit.*2|unexpected status/i);
  });

  it('rejects registered drift from a signal-terminated Expo process', () => {
    const result = gate.evaluate({ status: null, signal: 'SIGTERM', output: bothJestDrifts }, validRegistry());

    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/SIGTERM|signal|terminated/i);
  });

  it('preserves a signal-terminated spawn result for fail-closed evaluation', () => {
    let checkResult: CheckResult | undefined;
    try {
      jest.isolateModules(() => {
        jest.doMock('child_process', () => ({
          spawnSync: jest.fn(() => ({
            status: null,
            signal: 'SIGTERM',
            stdout: bothJestDrifts,
            stderr: '',
          })),
        }));
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const isolatedGate = require('../../scripts/expo-divergences') as typeof gate;
        checkResult = isolatedGate.runExpoCheck();
      });
    } finally {
      jest.dontMock('child_process');
    }

    expect(checkResult).toEqual({
      status: null,
      signal: 'SIGTERM',
      output: bothJestDrifts,
    });
    expect(gate.evaluate(checkResult as CheckResult, validRegistry()).ok).toBe(false);
  });

  it('rejects an unregistered drift alongside valid registered Jest drifts', () => {
    const result = gate.evaluate(
      {
        status: 1,
        output: driftOutput(
          '@types/jest@30.0.0 - expected version: 29.5.14',
          'jest@30.4.2 - expected version: ~29.7.0',
          'expo-camera@57.0.3 - expected version: ~57.0.4'
        ),
      },
      validRegistry()
    );

    expect(result.ok).toBe(false);
    expect(result.blocking.map((drift) => drift.package)).toEqual(['expo-camera']);
    expect(result.cleared.map((entry) => entry.package)).toEqual(['jest', '@types/jest']);
  });

  it('rejects a stale registration alongside a valid current Jest registration', () => {
    const stale = fixtureRegistry('expo-divergences-stale.json').divergences[0];
    const result = gate.evaluate(
      { status: 1, output: jestDrift },
      { divergences: [validEntry(), stale] }
    );

    expect(result.ok).toBe(false);
    expect(result.stale.map((entry) => entry.package)).toEqual(['expo-router']);
    expect(result.cleared.map((entry) => entry.package)).toEqual(['jest']);
  });

  it('expires a registry entry from SDK 56 when apps/mobile declares Expo SDK 57', () => {
    const registry = fixtureRegistry('expo-divergences-wrong-sdk.json');
    const result = gate.evaluate({ status: 1, output: jestDrift }, registry);

    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/EXPIRED with SDK 56.*SDK 57/i);
  });

  it.each(REQUIRED_FIELDS)('rejects a divergence missing required field %s', (field) => {
    const entry = validEntry();
    delete entry[field];

    const result = gate.evaluate({ status: 1, output: jestDrift }, { divergences: [entry] });

    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(new RegExp(`"${field}" is required`));
  });

  it('rejects duplicate package entries', () => {
    const result = gate.evaluate(
      { status: 1, output: jestDrift },
      { divergences: [validEntry(), validEntry()] }
    );

    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/duplicate.*jest/i);
  });

  it('rejects a recorded declaration that no longer matches apps/mobile/package.json', () => {
    const result = gate.evaluate(
      { status: 1, output: jestDrift },
      { divergences: [validEntry({ declared: '^29.7.0' })] }
    );

    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/jest.*declared.*\^29\.7\.0.*\^30\.4\.2/i);
  });

  it('rejects a recorded Expo pin that no longer matches the arbiter output', () => {
    const result = gate.evaluate(
      { status: 1, output: jestDrift },
      { divergences: [validEntry({ expoPins: '~29.6.0' })] }
    );

    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/jest.*expoPins.*~29\.6\.0.*~29\.7\.0/i);

    // The drift workflow decides whether to FILE AN ISSUE from this field. Asserting it by
    // identity, not just length: recovering the same fact by regex over `errors` is what this
    // field exists to replace, so a reworded message must not be able to empty it.
    expect(result.mismatched.map((entry) => entry.package)).toEqual(['jest']);
  });

  it('leaves mismatched empty when every registered pin still agrees with the arbiter', () => {
    // The negative half of the pair above — without it, a field hardwired to always report a
    // mismatch would satisfy the assertion and make the workflow file an issue on every run.
    const result = gate.evaluate({ status: 1, output: bothJestDrifts }, validRegistry());

    expect(result.mismatched).toEqual([]);
  });

  it('rejects malformed registry JSON instead of treating it as an empty registry', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'karmyq-expo-divergences-'));
    const malformed = join(tempDir, 'malformed.json');
    writeFileSync(malformed, '{ "divergences": [', 'utf8');

    try {
      expect(() => gate.readRegistry(malformed)).toThrow(/not valid JSON/i);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('passes only when both current Jest drifts are exactly registered for SDK 57', () => {
    const result = gate.evaluate({ status: 1, output: bothJestDrifts }, validRegistry());

    expect(result).toEqual({
      ok: true,
      errors: [],
      blocking: [],
      cleared: validRegistry().divergences,
      stale: [],
      mismatched: [],
    });
  });

  it('makes the real CLI exit non-zero for the constant-keyed wrong-SDK fixture', () => {
    // KARMYQ_EXPO_REGISTRY names a FIXTURE KEY, never a path. This proves the executable path
    // blocks without making the test depend on api.expo.dev or an arbitrary env-provided file.
    const cli = spawnSync(process.execPath, [SCRIPT, '--registry-only'], {
      cwd: ROOT,
      encoding: 'utf8',
      env: { ...process.env, KARMYQ_EXPO_REGISTRY: 'wrong-sdk' },
    });
    const output = `${cli.stdout ?? ''}${cli.stderr ?? ''}`;

    expect(cli.status).toBe(1);
    expect(output).toMatch(/EXPIRED with SDK 56.*SDK 57/i);
    expect(output).toMatch(/Expo divergence gate FAILED/i);
  });

  it.each([
    'tests/regression/fixtures/expo-divergences-wrong-sdk.json',
    'nope',
    'unknown-fixture',
  ])('refuses unknown registry key %s instead of treating it as a file path', (key) => {
    const cli = spawnSync(process.execPath, [SCRIPT, '--registry-only'], {
      cwd: ROOT,
      encoding: 'utf8',
      env: { ...process.env, KARMYQ_EXPO_REGISTRY: key },
    });
    const output = `${cli.stdout ?? ''}${cli.stderr ?? ''}`;

    expect(cli.status).toBe(1);
    expect(output).toMatch(/must name a known fixture/i);
  });
});
