/**
 * Shared Bull helpers for the Sprint 133 queue integration tests (BUG-060 reproduction, PR Q proof).
 * Not a suite: the integration testMatch is `**\/*.integration.test.ts`.
 */
import Queue from 'bull';
import { execFileSync } from 'child_process';
import { randomUUID } from 'crypto';

type Querier = { query: (sql: string, params?: unknown[]) => Promise<unknown> };

/** The IP addresses of the Redis clients attached as workers to a queue. */
export async function workerIps(queue: Queue.Queue): Promise<string[]> {
  const workers: Array<{ addr?: string }> = (await queue.getWorkers()) ?? [];
  return workers.map((w) => (w.addr ?? '').replace(/:\d+$/, ''));
}

/** A requester and a member, both active in one fresh community. */
export type CommunityFixture = { requester: string; member: string; community: string };
export const newCommunityFixture = (): CommunityFixture => ({ requester: randomUUID(), member: randomUUID(), community: randomUUID() });

export async function seedCommunityFixture(pool: Querier, f: CommunityFixture, label: string): Promise<void> {
  for (const id of [f.requester, f.member]) await pool.query('INSERT INTO auth.users(id,name,email,password_hash) VALUES ($1,$2,$3,$4)', [id, `${label} fixture`, `${id}@${label.toLowerCase().replace(/[^a-z0-9]/g, '')}.test`, 'not-a-login']);
  await pool.query('INSERT INTO communities.communities(id,name,description,creator_id) VALUES ($1,$2,$3,$4)', [f.community, `${label} ${f.community}`, 'Fixture', f.requester]);
  for (const id of [f.requester, f.member]) await pool.query("INSERT INTO communities.members(user_id,community_id,role,status) VALUES ($1,$2,'member','active')", [id, f.community]);
}

/** Removes the fixture and the notifications its member received. */
export async function removeCommunityFixture(pool: Querier, f: CommunityFixture): Promise<void> {
  await pool.query('DELETE FROM notifications.notifications WHERE user_id=$1', [f.member]);
  await pool.query('DELETE FROM communities.communities WHERE id=$1', [f.community]);
  await pool.query('DELETE FROM auth.users WHERE id=ANY($1::uuid[])', [[f.requester, f.member]]);
}

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
