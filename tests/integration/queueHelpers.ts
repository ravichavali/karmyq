/**
 * Shared Bull helpers for the Sprint 133 queue integration tests (BUG-060 reproduction, PR Q proof).
 * Not a suite: the integration testMatch is `**\/*.integration.test.ts`.
 */
import Queue from 'bull';
import { execFileSync } from 'child_process';

/** The IP addresses of a running compose container, for matching Bull worker client addresses. */
export const containerIps = (name: string): string[] =>
  execFileSync('docker', ['inspect', '-f', '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}', name], { encoding: 'utf8' })
    .trim().split(/\s+/).filter(Boolean);

/** Poll until every job is completed or failed; returns the refreshed jobs with their final state. */
export async function settle(jobs: Queue.Job[], timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const fresh = await Promise.all(jobs.map(async (j) => (await j.queue.getJob(j.id))!));
    const states = await Promise.all(fresh.map((j) => j.getState()));
    if (states.every((s) => s === 'completed' || s === 'failed')) return fresh.map((j, i) => ({ job: j, state: states[i] }));
    if (Date.now() > deadline) throw new Error(`jobs did not settle: ${JSON.stringify(states)}`);
    await new Promise((r) => setTimeout(r, 250));
  }
}
