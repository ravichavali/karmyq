/**
 * Sprint 131 PR B (BUG-036): CI waits for real readiness instead of `sleep 30`.
 *
 * The race existed because the services CI probed had no compose healthcheck, so nothing could say
 * when they were ready and the workflows guessed. The fix is at that depth: healthchecks on the
 * services, and `docker compose up --wait` naming exactly the services that have one. A bare
 * `--wait` would also wait on one-shot containers (tests/docker-compose.test.yml's `test-runner`
 * exits by design) and on observability containers with no healthcheck, so the names matter.
 *
 * HONEST LIMIT: this parses YAML. It cannot prove Docker runs the probes; the PR's own "Test Docker
 * Build" and "Integration Tests" runs are that evidence.
 */
import { parse as parseYaml } from 'yaml';

import { read } from './helpers/workspaces';

type Step = { name?: string; run?: string; if?: string };
type Service = { healthcheck?: { test?: string | string[] } };

const yaml = (rel: string) => parseYaml(read(rel));
const steps = (workflow: string, job: string): Step[] => yaml(workflow).jobs[job].steps;
const probe = (service: Service): string => [service.healthcheck?.test ?? []].flat().join(' ');
const MAX_WAIT_SECONDS = 300;

/** The index of the step that runs `docker compose ... up -d --wait`, and its argv tail. */
function waitStep(all: Step[]) {
  const index = all.findIndex((s) => /docker compose .* up -d --wait\b/.test(s.run ?? ''));
  expect(index).toBeGreaterThanOrEqual(0);
  const run = all[index].run ?? '';
  const timeout = Number(run.match(/--wait-timeout\s+(\d+)/)?.[1]);
  const services = run.trim().split(/\s+/).slice(run.trim().split(/\s+/).indexOf(String(timeout)) + 1);
  return { index, run, timeout, services };
}

/** No fixed sleep anywhere, and no probe before readiness is proven (a pre-wait curl is the old race). */
function noGuessing(all: Step[], waitIndex: number) {
  expect(all.map((s) => s.run ?? '').join('\n')).not.toMatch(/\bsleep\s+\d+/);
  expect(all.slice(0, waitIndex + 1).map((s) => s.run ?? '').join('\n')).not.toMatch(/\bcurl\b/);
}

describe('Test Docker Build waits on healthchecks (BUG-036)', () => {
  const all = steps('.github/workflows/test.yml', 'docker-build');
  const compose = yaml('infrastructure/docker/docker-compose.yml').services;

  it('starts the stack, then waits (bounded) for auth-service and frontend to be healthy', () => {
    const start = all.findIndex((s) => /docker compose .* up -d\s*$/.test(s.run ?? ''));
    const wait = waitStep(all);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(wait.index).toBeGreaterThan(start);
    expect(wait.timeout).toBeGreaterThan(0);
    expect(wait.timeout).toBeLessThanOrEqual(MAX_WAIT_SECONDS);
    expect(wait.services.sort()).toEqual(['auth-service', 'frontend']);
    noGuessing(all, wait.index);
  });

  it('after the wait, checks from the runner that both published ports answer', () => {
    // Healthchecks run inside the containers, so they cannot see a broken `ports:` mapping.
    const wait = waitStep(all);
    const check = all.findIndex((s, i) => i > wait.index && /curl -f\S* .*127\.0\.0\.1:3001\/health/.test(s.run ?? ''));
    expect(check).toBeGreaterThan(wait.index);
    expect(all[check].run).toMatch(/curl -f\S* .*127\.0\.0\.1:3000\//);
  });

  it('every service it waits on has a healthcheck in the compose file', () => {
    for (const name of waitStep(all).services) expect(probe(compose[name])).not.toBe('');
  });

  it('auth-service probes its /health endpoint', () => {
    expect(probe(compose['auth-service'])).toContain(':3001/health');
  });

  it("frontend probes the container's own hostname, not loopback", () => {
    // Next.js standalone binds to process.env.HOSTNAME, which Docker sets to the container id, so the
    // server does not listen on 127.0.0.1 (node_modules/next/dist/build/utils.js). A loopback probe
    // would report a healthy frontend as unhealthy.
    // `$$` is compose's escape for a literal `$`. A single `$(hostname)` is rejected by compose as an
    // invalid interpolation, so the escaped form is part of what must be true.
    const test = probe(compose.frontend);
    expect(test).toContain('$$(hostname):3000');
    expect(test).not.toMatch(/127\.0\.0\.1|localhost/);
  });

  it('still dumps compose logs after a failed wait', () => {
    const logs = all.findIndex((s) => s.if === 'failure()' && /docker compose .* logs\b/.test(s.run ?? ''));
    expect(logs).toBeGreaterThan(waitStep(all).index);
  });
});

describe('Integration Tests waits on healthchecks (BUG-036)', () => {
  const all = steps('.github/workflows/ci.yml', 'test-integration');
  const compose = yaml('tests/docker-compose.test.yml').services as Record<string, Service>;
  const healthchecked = Object.entries(compose)
    .filter(([, service]) => probe(service) !== '')
    .map(([name]) => name)
    .sort();

  it('the test compose file has healthchecked services to wait on', () => {
    expect(healthchecked.length).toBeGreaterThan(0);
    expect(healthchecked).not.toContain('test-runner');
  });

  it('waits (bounded) on exactly the healthchecked test services, never the one-shot runner', () => {
    const wait = waitStep(all);
    expect(wait.run).toContain('docker-compose.test.yml');
    expect(wait.timeout).toBeGreaterThan(0);
    expect(wait.timeout).toBeLessThanOrEqual(MAX_WAIT_SECONDS);
    expect(wait.services.sort()).toEqual(healthchecked);
    noGuessing(all.slice(0, wait.index + 1), wait.index);
  });
});
