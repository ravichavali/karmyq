/**
 * Sprint 131 PR B (BUG-036): the WIRING of the readiness wait into "Test Docker Build".
 *
 * sprint-131-wait-for-http.test.ts proves the script's behavior. This file proves the job
 * actually uses it: after `up -d`, for BOTH auth health and the frontend, with every bound set,
 * under the Node major it is tested with, and that the failure-log step survives.
 *
 * HONEST LIMIT: this parses YAML; it cannot prove GitHub runs it. The PR's own "Test Docker Build"
 * run is that evidence (Task 7).
 */
import { readFileSync } from 'fs';
import { join } from 'path';
// `yaml` is what the tests workspace DECLARES; js-yaml is only a root dependency.
import { parse as parseYaml } from 'yaml';

type Step = { name?: string; run?: string; if?: string; uses?: string; with?: Record<string, unknown> };

const WORKFLOW = join(__dirname, '..', '..', '.github', 'workflows', 'test.yml');
const steps: Step[] = parseYaml(readFileSync(WORKFLOW, 'utf8')).jobs['docker-build'].steps;

/** A step's executed command with shell line-continuations joined. */
const command = (s: Step) => (s.run ?? '').replace(/\\\n\s*/g, ' ');

const startIdx = steps.findIndex((s) => /docker compose .* up -d\b/.test(command(s)));
const waitIdx = steps.findIndex((s) => command(s).includes('scripts/wait-for-http.js'));

function bound(flag: string): number {
  const match = command(steps[waitIdx]).match(new RegExp(`${flag}\\s+(\\d+)`));
  expect(match).not.toBeNull();
  return Number(match![1]);
}

describe('Test Docker Build waits for readiness instead of guessing (BUG-036)', () => {
  it('starts the stack, then runs the bounded readiness wait', () => {
    expect(startIdx).toBeGreaterThanOrEqual(0);
    expect(waitIdx).toBeGreaterThan(startIdx);
  });

  it('no step sleeps a fixed duration or probes with a one-shot curl', () => {
    const all = steps.map(command).join('\n');
    expect(all).not.toMatch(/\bsleep\s+\d+/);
    expect(all).not.toMatch(/\bcurl\b/);
  });

  it('waits for BOTH auth-service health and the frontend', () => {
    expect(waitIdx).toBeGreaterThanOrEqual(0);
    const cmd = command(steps[waitIdx]);
    // 127.0.0.1: compose publishes these ports on 127.0.0.1 only (docker-compose.yml).
    expect(cmd).toContain('http://127.0.0.1:3001/health');
    expect(cmd).toContain('http://127.0.0.1:3000');
  });

  it('sets every bound, and the worst case stays under five minutes', () => {
    expect(waitIdx).toBeGreaterThanOrEqual(0);
    const attempts = bound('--attempts');
    const intervalMs = bound('--interval-ms');
    const timeoutMs = bound('--timeout-ms');
    for (const n of [attempts, intervalMs, timeoutMs]) expect(n).toBeGreaterThan(0);
    // URLs are probed concurrently, so one attempt costs at most one timeout.
    expect(attempts * timeoutMs + (attempts - 1) * intervalMs).toBeLessThanOrEqual(300_000);
  });

  it('sets up Node 24 before the wait runs', () => {
    const setup = steps.findIndex((s) => (s.uses ?? '').startsWith('actions/setup-node@'));
    expect(setup).toBeGreaterThanOrEqual(0);
    expect(setup).toBeLessThan(waitIdx);
    expect(String(steps[setup].with?.['node-version'])).toBe('24');
  });

  it('still dumps compose logs after a failed wait', () => {
    const logs = steps.findIndex((s) => s.if === 'failure()' && /docker compose .* logs\b/.test(command(s)));
    expect(logs).toBeGreaterThan(waitIdx);
  });
});
