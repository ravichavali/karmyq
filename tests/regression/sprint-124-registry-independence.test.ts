// eslint-disable-next-line @typescript-eslint/no-var-requires
const auditGate = require('../../scripts/audit-exemptions') as {
  evaluateAudit: (report: unknown, registry: unknown, now?: Date) => GateResult;
  readRegistry: () => unknown;
};
// eslint-disable-next-line @typescript-eslint/no-var-requires
const expoGate = require('../../scripts/expo-divergences') as {
  evaluate: (checkResult: ExpoCheckResult, registry: unknown) => GateResult;
  readRegistry: () => unknown;
};

type GateResult = {
  ok: boolean;
  errors: string[];
  blocking: Array<{ package: string }>;
  cleared: Array<{ package: string }>;
};

type ExpoCheckResult = {
  status: number;
  output: string;
};

const NOW = new Date('2026-08-11T12:00:00Z');

const advisory = (id: string) => ({
  source: 123456,
  name: 'image-size',
  dependency: 'image-size',
  title: 'controlled audit finding',
  url: `https://github.com/advisories/${id}`,
  severity: 'high',
  range: '<=2.0.2',
});

const auditReport = {
  vulnerabilities: {
    'image-size': {
      name: 'image-size',
      severity: 'high',
      via: [
        advisory('GHSA-w3rx-r6r6-pgpr'),
        advisory('GHSA-5p2g-fcmc-qvqq'),
      ],
    },
  },
};

const expoCheck: ExpoCheckResult = {
  status: 1,
  output: [
    'The following packages should be updated for best compatibility with the installed expo version:',
    '  @types/jest@30.0.0 - expected version: 29.5.14',
    '  jest@30.4.2 - expected version: ~29.7.0',
    'Your project may not work correctly until you install the expected versions of the packages.',
    'Found outdated dependencies',
  ].join('\n'),
};

describe('Sprint 124 audit and Expo registry independence', () => {
  const auditRegistry = auditGate.readRegistry();
  const expoRegistry = expoGate.readRegistry();

  it('the shipped audit registry clears only audit findings and cannot clear Expo drift', () => {
    const nativeResult = auditGate.evaluateAudit(auditReport, auditRegistry, NOW);
    expect(nativeResult.ok).toBe(true);
    expect(nativeResult.cleared.map((entry) => entry.package)).toEqual(['image-size']);

    const crossResult = expoGate.evaluate(expoCheck, auditRegistry);
    expect(crossResult.ok).toBe(false);
    expect(crossResult.errors).toEqual(['registry.divergences must be an array']);
    expect(crossResult.cleared).toEqual([]);
  });

  it('the shipped Expo registry clears only Expo drift and cannot exempt audit findings', () => {
    const nativeResult = expoGate.evaluate(expoCheck, expoRegistry);
    expect(nativeResult.ok).toBe(true);
    expect(nativeResult.cleared.map((entry) => entry.package)).toEqual(['jest', '@types/jest']);

    const crossResult = auditGate.evaluateAudit(auditReport, expoRegistry, NOW);
    expect(crossResult.ok).toBe(false);
    expect(crossResult.errors).toEqual(['registry.exemptions must be an array']);
    expect(crossResult.cleared).toEqual([]);
  });
});
