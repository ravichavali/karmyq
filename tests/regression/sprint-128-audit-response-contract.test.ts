import { spawnSync } from 'child_process';
import { join } from 'path';

const gate = require('../../scripts/audit-exemptions');
const ROOT = join(__dirname, '..', '..');
const NOW = new Date('2026-09-08T12:00:00Z');
const exemption = {
  package: 'image-size', advisory: 'GHSA-w3rx-r6r6-pgpr', severity: 'high',
  rationale: 'Synthetic unavailable-evidence fixture; never a real exemption.',
  decision: 'Test fixture only', owner: 'test', created: '2026-09-01', expires: '2026-09-15',
};
const finding = {
  name: 'image-size', severity: 'high',
  via: [{ url: 'https://github.com/advisories/GHSA-w3rx-r6r6-pgpr', severity: 'high', title: 'fixture' }],
};
const clean = { vulnerabilities: {} };
const affected = { vulnerabilities: { 'image-size': finding } };
const invalidReports: [string, unknown][] = [
  ['null', null], ['array', []], ['empty object', {}],
  ['npm error', { error: { code: 'E503', summary: 'PRIVATE_SENTINEL' } }],
  ['error with valid-looking findings', { ...clean, error: {} }],
  ['null map', { vulnerabilities: null }], ['array map', { vulnerabilities: [] }],
  ['null entry', { vulnerabilities: { broken: null } }],
  ['unknown severity', { vulnerabilities: { 'image-size': { ...finding, severity: 'urgent' } } }],
  ['missing name', { vulnerabilities: { 'image-size': { severity: 'high', via: finding.via } } }],
  ['mismatched name', { vulnerabilities: { other: finding } }],
  ['missing via', { vulnerabilities: { 'image-size': { name: 'image-size', severity: 'high' } } }],
  ['malformed advisory', { vulnerabilities: { 'image-size': { ...finding, via: [null] } } }],
  ['advisory missing severity', { vulnerabilities: { 'image-size': { ...finding, via: [{ url: finding.via[0].url }] } } }],
  ['dangling reference', { vulnerabilities: { parent: { name: 'parent', severity: 'high', via: ['absent'] } } }],
  ['critical hidden under low root', { vulnerabilities: { 'image-size': { ...finding, severity: 'low', via: [{ ...finding.via[0], severity: 'critical' }] } } }],
  ['high hidden under low parent', { vulnerabilities: { 'image-size': finding, parent: { name: 'parent', severity: 'low', via: ['image-size'] } } }],
];

describe.each([{ exemptions: [] }, { exemptions: [exemption] }])('audit evidence before registry matching (%j)', registry => {
  it.each(invalidReports)('rejects %s without removal advice', (_name, report) => {
    expect(gate.evaluateAudit(report, registry, NOW)).toEqual({
      ok: false,
      errors: ['Audit evidence unavailable or invalid; retry the audit before evaluating exemptions.'],
      blocking: [], cleared: [], unused: [],
    });
  });
});

it('retains clean, exemption and unmatched-entry policy for valid reports', () => {
  expect(gate.evaluateAudit(clean, { exemptions: [] }, NOW).ok).toBe(true);
  expect(gate.evaluateAudit(affected, { exemptions: [] }, NOW).blocking).toHaveLength(1);
  expect(gate.evaluateAudit(affected, { exemptions: [exemption] }, NOW).ok).toBe(true);
  expect(gate.evaluateAudit(clean, { exemptions: [exemption] }, NOW).unused).toEqual([exemption]);
});

it('never exempts a critical root even when its leaf advisory is registered high', () => {
  const report = { vulnerabilities: { 'image-size': { ...finding, severity: 'critical' } } };
  expect(gate.evaluateAudit(report, { exemptions: [exemption] }, NOW).ok).toBe(false);
});

it.each([true, false])('duplicate advisory order cannot clear critical (critical first=%s)', first => {
  const high = finding.via[0]; const critical = { ...high, severity: 'critical' };
  const report = { vulnerabilities: { 'image-size': { ...finding, severity: 'critical', via: first ? [critical, high] : [high, critical] } } };
  expect(gate.evaluateAudit(report, { exemptions: [exemption] }, NOW).ok).toBe(false);
});

it('captures real child stderr before producing a sanitized acquisition error', () => {
  const result = spawnSync(process.execPath, ['-e', `
    const cp = require('child_process');
    const real = cp.execFileSync;
    cp.execFileSync = (_file, _args, options) => real(process.execPath,
      ['-e', 'process.stderr.write("PRIVATE_SENTINEL");process.exit(1)'], options);
    try { require('./scripts/audit-exemptions').runAudit(); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
  `], { cwd: ROOT, encoding: 'utf8', timeout: 10000 });
  expect(result.status).toBe(1);
  expect(result.stderr).toMatch(/audit evidence unavailable or invalid/i);
  expect(result.stderr + result.stdout).not.toContain('PRIVATE_SENTINEL');
});

type ProcessCase = { stdout: string; status?: number | null; code?: string; signal?: string; killed?: boolean };
// Only the external process boundary is replaced. The real parser, evaluator and CLI execute
// in a fresh Node process; no production fixture selector or arbitrary path is introduced.
function invoke(scenario: ProcessCase, cli = false, emptyRegistry = true) {
  const script = `
    const scenario = JSON.parse(process.argv[1]);
    require('child_process').execFileSync = (_file, _args, options) => {
      if (!Number.isFinite(options.timeout) || options.timeout <= 0) throw new Error('missing timeout');
      if (scenario.status !== undefined || scenario.code || scenario.signal || scenario.killed) {
        throw Object.assign(new Error('PRIVATE_SENTINEL'), scenario);
      }
      return scenario.stdout;
    };
    const file = require('path').join(process.cwd(), 'scripts/audit-exemptions.js');
    if (process.argv[2] === 'cli') {
      process.argv = [process.execPath, file];
      require('module').runMain();
    } else {
      try { console.log(JSON.stringify(require(file).runAudit())); }
      catch (error) { console.error(error.message); process.exitCode = 1; }
    }
  `;
  return spawnSync(process.execPath, ['-e', script, JSON.stringify(scenario), cli ? 'cli' : 'api'], {
    cwd: ROOT, encoding: 'utf8', timeout: 10000,
    env: { ...process.env, KARMYQ_AUDIT_REGISTRY: emptyRegistry ? 'empty' : '' },
  });
}

describe('audit acquisition and actual CLI', () => {
  it.each([['success', { stdout: JSON.stringify(clean) }], ['findings', { stdout: JSON.stringify(affected), status: 1 }]] as const)(
    'accepts supported %s output', (_name, scenario) => {
      const result = invoke(scenario);
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(0);
      expect(JSON.parse(result.stdout)).toEqual(JSON.parse(scenario.stdout));
    },
  );
  const badProcesses: [string, ProcessCase][] = [
    ['empty stdout', { stdout: '' }], ['invalid JSON', { stdout: 'PRIVATE_SENTINEL' }],
    ['parsed npm error', { stdout: JSON.stringify({ error: { summary: 'PRIVATE_SENTINEL' } }), status: 1 }],
    ['unsupported exit', { stdout: JSON.stringify(clean), status: 2 }],
    ['spawn error', { stdout: JSON.stringify(clean), code: 'ENOENT' }],
    ['timeout with partial JSON', { stdout: JSON.stringify(clean), status: 1, code: 'ETIMEDOUT' }],
    ['signal with partial JSON', { stdout: JSON.stringify(clean), status: null, signal: 'SIGTERM' }],
    ['killed process', { stdout: JSON.stringify(clean), status: 1, killed: true }],
  ];
  it.each(badProcesses)('fails acquisition for %s without exposing process output', (_name, scenario) => {
    const result = invoke(scenario);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/audit evidence unavailable or invalid/i);
    expect(result.stdout + result.stderr).not.toContain('PRIVATE_SENTINEL');
  });
  it.each([true, false])('CLI fails closed on unavailable evidence (empty fixture=%s)', empty => {
    const result = invoke({ stdout: JSON.stringify({ error: { summary: 'PRIVATE_SENTINEL' } }), status: 1 }, true, empty);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/audit evidence unavailable or invalid/i);
    expect(result.stderr).toContain('ADR-059 gate FAILED');
    expect(result.stdout + result.stderr).not.toMatch(/PRIVATE_SENTINEL|gate clean|remove it|upstream may be fixed/);
  });
  it('CLI still accepts a valid clean report with an empty registry', () => {
    const result = invoke({ stdout: JSON.stringify(clean) }, true);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('gate clean: 0 high/critical');
  });
  it('CLI blocks a real-shaped high finding even after the live tree is remediated', () => {
    const result = invoke({ stdout: JSON.stringify(affected), status: 1 }, true);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('BLOCKING (high): image-size');
    expect(result.stderr).toContain('ADR-059 gate FAILED');
  });
});
