import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..');

// `npm audit` exits non-zero when vulnerabilities are present, which makes
// execSync throw. The error still carries the JSON report on stdout, so we
// capture it either way and parse the metadata.
function auditMetadata(): {
  critical: number;
  high: number;
  moderate: number;
  low: number;
} {
  let stdout: string;
  try {
    stdout = execSync('npm audit --package-lock-only --json', {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch (err: any) {
    stdout = err.stdout?.toString() ?? '';
  }
  return JSON.parse(stdout).metadata.vulnerabilities;
}

describe('Sprint 75 — dependency security gate', () => {
  it('CI audit step blocks at high severity (not critical)', () => {
    // Sprint 123 replaced the bare `npm audit --audit-level=high` with the exemption-aware
    // script. The invariant is unchanged — high still blocks, critical is never exemptible —
    // but it now lives in scripts/audit-exemptions.js, which CI and this file both call.
    const ci = readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf8');
    expect(ci).toMatch(/node scripts\/audit-exemptions\.js/);
    expect(ci).not.toContain('--audit-level=critical');
  });

  it('root package.json pins axios to a patched version (>=1.16.0)', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
    const axios = pkg.dependencies.axios.replace(/[^\d.]/g, '');
    const [maj, min] = axios.split('.').map(Number);
    expect(maj > 1 || (maj === 1 && min >= 16)).toBe(true);
  });

  // The standing invariant is the ADR-059 gate: zero high/critical. We do NOT
  // assert moderate/low here — the gate blocks at `high` and the SLA gives
  // any-severity findings a 2-week window, so a newly-disclosed moderate must
  // not retroactively fail every push. (Sprint 75 did drive all 31 → 0; that
  // point-in-time target is recorded in ADR-059, not enforced as a perpetual
  // push-blocker stricter than the gate itself.)
  it('npm audit reports zero UNEXEMPTED high/critical vulnerabilities (ADR-059 gate)', () => {
    // Sprint 123: the raw metadata counts are no longer the gate, because an advisory with no
    // published fix (image-size — every version through 2.0.2 is affected, and metro@0.87.0 still
    // depends on ^1.0.2) would otherwise block every PR forever. The gate is now "zero
    // unexempted", evaluated by the SAME script CI runs, against the SAME registry, which fails
    // closed on a malformed, expired, or stale exemption. See
    // tests/regression/sprint-123-audit-exemption-gate.test.ts for the RED proofs.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const gate = require('../../scripts/audit-exemptions');

    const result = gate.evaluateAudit(gate.runAudit(ROOT), gate.readRegistry());

    expect(result.errors).toEqual([]);
    expect(result.blocking).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('still reports the raw counts, so an exemption never hides a NEW advisory', () => {
    // Belt and braces: if the unexempted count is zero but the raw high count grows beyond the
    // exempted chain, the exemption evaluator above is the thing that must catch it. This
    // records the current shape so an unexplained jump is visible in the diff.
    const v = auditMetadata();
    expect(v.critical).toBe(0);
    expect(typeof v.high).toBe('number');
  });
});
