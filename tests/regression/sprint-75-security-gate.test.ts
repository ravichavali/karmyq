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
    const ci = readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf8');
    expect(ci).toContain('--audit-level=high');
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
  it('npm audit reports zero high/critical vulnerabilities (ADR-059 gate)', () => {
    const v = auditMetadata();
    expect(v.high).toBe(0);
    expect(v.critical).toBe(0);
  });
});
