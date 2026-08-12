// eslint-disable-next-line @typescript-eslint/no-var-requires
const auditGate = require('../../scripts/audit-exemptions') as {
  evaluateAudit: (report: unknown, registry: unknown, now?: Date) => GateResult;
  readRegistry: () => { exemptions: Array<{ created: string }> };
};
// eslint-disable-next-line @typescript-eslint/no-var-requires
const expoGate = require('../../scripts/expo-divergences') as {
  evaluate: (checkResult: ExpoCheckResult, registry: unknown) => GateResult;
  readRegistry: () => {
    divergences: Array<{ package: string; declared: string; expoPins: string }>;
  };
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

// Derived from the shipped registry, never a frozen literal. This suite exercises the real
// time-boxed audit registry, which by design must be renewed before it expires — and since an
// exemption's `created` may not be in the future, a hardcoded clock goes red on the next renewal
// instead of on a real defect. Reading the registry's own `created` pins the clock to the moment
// the entries were written, which is what these assertions actually mean.
const SHIPPED_AUDIT_REGISTRY = auditGate.readRegistry();
const NOW = new Date(`${SHIPPED_AUDIT_REGISTRY.exemptions[0].created}T12:00:00Z`);

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

// Synthesised FROM the shipped Expo registry rather than hardcoded. This suite feeds the real
// registry to the gate, and the drift issue the workflow files tells maintainers to "update or
// remove the entry in security/expo-divergences.json" — with the arbiter output frozen here,
// following those instructions would leave the blocking regression tier red for a reason
// unrelated to what this suite tests. Derived, the two move together.
const SHIPPED_EXPO_REGISTRY = expoGate.readRegistry();

const expoCheck: ExpoCheckResult = {
  status: 1,
  output: [
    'The following packages should be updated for best compatibility with the installed expo version:',
    ...SHIPPED_EXPO_REGISTRY.divergences.map(
      (entry) =>
        `  ${entry.package}@${entry.declared.replace(/^[\^~]/, '')} - expected version: ${entry.expoPins}`
    ),
    'Your project may not work correctly until you install the expected versions of the packages.',
    'Found outdated dependencies',
  ].join('\n'),
};

describe('Sprint 124 audit and Expo registry independence', () => {
  const auditRegistry = SHIPPED_AUDIT_REGISTRY;
  const expoRegistry = SHIPPED_EXPO_REGISTRY;

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
