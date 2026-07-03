/**
 * Sprint 117 — Curated Demo Fixtures: manifest compiler.
 *
 * Validates every semantic reference and hard invariant, then derives stable UUIDs (from
 * semantic keys) and reset-relative timestamps (from one UTC anchor) into a dependency-ordered
 * `CompiledDemoBaseline`. Compiling the same manifest against two anchors yields identical IDs
 * and every timestamp shifted by exactly the anchor delta — the property the reset relies on.
 */

import { createHash } from 'node:crypto';
import {
  CURATED_DEMO_MANIFEST,
  MIN_ACTIVE_MEMBERS_PER_COMMUNITY,
  STORY_HARD_FLOOR,
  getProtectedFixtureEmails,
} from './manifest';
import type {
  CompiledActivity,
  CompiledCommunity,
  CompiledCompletedExchange,
  CompiledDemoBaseline,
  CompiledGovernance,
  CompiledMatch,
  CompiledMembership,
  CompiledPerson,
  CompiledProvider,
  CompiledRequest,
  DemoFixtureManifest,
  FixtureAge,
  RequestLifecycle,
  SemanticKey,
} from './types';

export { CURATED_DEMO_MANIFEST, getProtectedFixtureEmails };

/** RFC-4122 v5-style namespace for all curated-demo UUIDs. */
const FIXTURE_NAMESPACE = '75648739-6e64-4d8b-b594-0fd70f609d2d';
const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const REQUEST_TTL_MS = 60 * DAY_MS; // ADR: help requests live 60 days.

const VALID_LIFECYCLE: ReadonlySet<RequestLifecycle> = new Set<RequestLifecycle>([
  'open', 'proposed', 'matched', 'completed', 'rejected', 'declined', 'cancelled', 'expired', 'forgotten',
]);

function uuidFrom(raw: string): string {
  const namespace = Buffer.from(FIXTURE_NAMESPACE.replace(/-/g, ''), 'hex');
  const bytes = createHash('sha1').update(namespace).update(raw, 'utf8').digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC-4122 variant
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Deterministic UUID for a semantic key. Stable across anchors and processes. */
export function semanticUuid(key: SemanticKey): string {
  return uuidFrom(key);
}

/**
 * The match UUID an exchange materializes as. The projection carries exchange keys in its karma
 * records' `relatedEntityId`; the baseline writer maps them back to this UUID so the value is a
 * real UUID (matching the completed match row), not a semantic key string.
 */
export function exchangeMatchId(exchangeKey: string): string {
  return uuidFrom(`match:${exchangeKey}`);
}

function durationMs(age: FixtureAge): number {
  const match = /^(?:P(?:(\d+)D)|PT(\d+)H)$/.exec(age);
  if (!match) throw new Error(`Invalid fixture age: ${age}`);
  return Number(match[1] ?? 0) * DAY_MS + Number(match[2] ?? 0) * HOUR_MS;
}

/** A timestamp `age` in the past relative to the anchor. */
export function ageFrom(anchor: Date, age: FixtureAge): Date {
  return new Date(anchor.getTime() - durationMs(age));
}

/** A timestamp `age` in the future relative to the anchor (upcoming activities). */
function futureFrom(anchor: Date, age: FixtureAge): Date {
  return new Date(anchor.getTime() + durationMs(age));
}

function fail(message: string): never {
  throw new Error(message);
}

/**
 * Compile the manifest into a dependency-ordered baseline. Throws on any dangling semantic
 * reference, invalid lifecycle, weak cohort, Maria admin role, or tuning that tries to breach
 * a hard story floor.
 */
export function compileManifest(manifest: DemoFixtureManifest, anchor: Date): CompiledDemoBaseline {
  validateHardFloors(manifest);

  const personKeys = new Set(manifest.people.map(p => p.key));
  const communityKeys = new Set(manifest.communities.map(c => c.key));

  validateUniqueness(manifest);
  validateReferences(manifest, personKeys, communityKeys);
  validateMariaMemberOnly(manifest);
  validateCommunityCount(manifest);
  validatePeopleCount(manifest);
  validateActiveCohorts(manifest);
  validateLifecycles(manifest);

  const personIdByKey = new Map<SemanticKey, string>();
  const people: CompiledPerson[] = manifest.people.map(p => {
    const id = semanticUuid(p.key);
    personIdByKey.set(p.key, id);
    return { id, key: p.key, name: p.name, email: p.email, classification: p.classification, bio: p.bio ?? null };
  });

  const communityIdByKey = new Map<SemanticKey, string>();
  const communities: CompiledCommunity[] = manifest.communities.map(c => {
    const id = semanticUuid(c.key);
    communityIdByKey.set(c.key, id);
    const creatorKey = findCommunityCreator(manifest, c.key);
    return {
      id,
      key: c.key,
      name: c.name,
      category: c.type,
      communityType: c.type === 'group' ? 'group' : 'mutual_aid',
      creatorId: personIdByKey.get(creatorKey)!,
    };
  });

  const memberships: CompiledMembership[] = manifest.memberships.map(m => ({
    id: uuidFrom(`membership:${m.user}:${m.community}`),
    userId: personIdByKey.get(m.user)!,
    communityId: communityIdByKey.get(m.community)!,
    role: m.role,
    status: m.status,
    joinedAt: ageFrom(anchor, m.joinedAge),
  }));

  // Lifecycle-texture requests first so requests[0] stays the fresh, anchor-relative example.
  const lifecycleRequests: CompiledRequest[] = manifest.requests.map(r => {
    const id = semanticUuid(r.key);
    const createdAt = ageFrom(anchor, r.createdAge);
    const expiresAt = r.expiresAge ? ageFrom(anchor, r.expiresAge) : new Date(createdAt.getTime() + REQUEST_TTL_MS);
    const expired = r.status === 'expired' || r.status === 'forgotten' || expiresAt.getTime() < anchor.getTime();
    let match: CompiledMatch | null = null;
    if (r.helper && r.matchStatus) {
      match = {
        id: uuidFrom(`match:${r.key}`),
        requestId: id,
        responderId: personIdByKey.get(r.helper)!,
        status: r.matchStatus,
        completedAt: r.completedAge ? ageFrom(anchor, r.completedAge) : null,
        createdAt,
      };
    }
    return {
      id,
      key: r.key,
      requesterId: personIdByKey.get(r.requester)!,
      communityIds: r.communities.map(c => communityIdByKey.get(c)!),
      title: r.title,
      description: r.description,
      category: r.category,
      requestType: r.requestType ?? 'generic',
      status: r.status,
      visibility: r.visibility ?? 'community',
      createdAt,
      expiresAt,
      expired,
      forgotten: r.forgotten === true,
      match,
    };
  });

  // Each completed exchange also materializes as a completed request + match for realism.
  const exchangeRequests: CompiledRequest[] = manifest.exchanges.map(e => {
    const requestKey = `request.${e.key.slice('exchange.'.length)}`;
    const requestId = semanticUuid(requestKey);
    const completedAt = ageFrom(anchor, e.completedAge);
    const createdAt = new Date(completedAt.getTime() - 2 * DAY_MS);
    const match: CompiledMatch = {
      id: exchangeMatchId(e.key),
      requestId,
      responderId: personIdByKey.get(e.helper)!,
      status: 'completed',
      completedAt,
      createdAt,
    };
    return {
      id: requestId,
      key: requestKey,
      requesterId: personIdByKey.get(e.requester)!,
      communityIds: [communityIdByKey.get(e.community)!],
      title: e.title ?? `Completed help (${e.category ?? 'errand'})`,
      description: e.title ?? 'A completed neighbourly exchange.',
      category: e.category ?? 'errand',
      requestType: 'generic',
      status: 'completed',
      visibility: 'community',
      createdAt,
      expiresAt: new Date(createdAt.getTime() + REQUEST_TTL_MS),
      expired: false,
      forgotten: false,
      match,
    };
  });

  const providers: CompiledProvider[] = manifest.providers.map(p => ({
    id: semanticUuid(p.key),
    key: p.key,
    userId: personIdByKey.get(p.user)!,
    communityId: communityIdByKey.get(p.community)!,
    serviceType: p.serviceType,
    description: p.description,
  }));

  const governance: CompiledGovernance[] = manifest.governance.map(g => ({
    id: semanticUuid(g.key),
    key: g.key,
    communityId: communityIdByKey.get(g.community)!,
    proposerId: personIdByKey.get(g.proposer)!,
    title: g.title,
    description: g.description,
    status: g.status,
    createdAt: ageFrom(anchor, g.createdAge),
  }));

  const activities: CompiledActivity[] = manifest.activities.map(a => ({
    id: semanticUuid(a.key),
    key: a.key,
    communityId: communityIdByKey.get(a.community)!,
    organizerId: personIdByKey.get(a.organizer)!,
    title: a.title,
    description: a.description,
    scheduledAt: futureFrom(anchor, a.scheduledAge),
    createdAt: ageFrom(anchor, a.createdAge),
  }));

  const projectionEvents: CompiledCompletedExchange[] = manifest.exchanges
    .map(e => ({
      key: e.key,
      requesterId: personIdByKey.get(e.requester)!,
      helperId: personIdByKey.get(e.helper)!,
      communityId: communityIdByKey.get(e.community)!,
      communityKey: e.community,
      completedAt: ageFrom(anchor, e.completedAge),
      category: e.category ?? 'errand',
    }))
    .sort((a, b) => a.completedAt.getTime() - b.completedAt.getTime() || a.key.localeCompare(b.key));

  return {
    anchor,
    people,
    communities,
    memberships,
    requests: [...lifecycleRequests, ...exchangeRequests],
    providers,
    governance,
    activities,
    projectionEvents,
    expectedBehaviors: manifest.expectedBehaviors,
  };
}

function validateHardFloors(manifest: DemoFixtureManifest): void {
  const t = manifest.tuning;
  if (t.maxPathDegree > STORY_HARD_FLOOR.maxPathDegree) {
    fail(`Refusing manifest: maxPathDegree ${t.maxPathDegree} breaches hard floor ${STORY_HARD_FLOOR.maxPathDegree}`);
  }
  if (t.minSharedPeople < STORY_HARD_FLOOR.minSharedPeople) {
    fail(`Refusing manifest: minSharedPeople ${t.minSharedPeople} breaches hard floor ${STORY_HARD_FLOOR.minSharedPeople}`);
  }
  if (t.minOneHopPerSide < STORY_HARD_FLOOR.minOneHopPerSide) {
    fail(`Refusing manifest: minOneHopPerSide ${t.minOneHopPerSide} breaches hard floor ${STORY_HARD_FLOOR.minOneHopPerSide}`);
  }
}

function validateUniqueness(manifest: DemoFixtureManifest): void {
  const seen = new Set<string>();
  const all: SemanticKey[] = [
    ...manifest.people.map(p => p.key),
    ...manifest.communities.map(c => c.key),
    ...manifest.requests.map(r => r.key),
    ...manifest.exchanges.map(e => e.key),
    ...manifest.providers.map(p => p.key),
    ...manifest.governance.map(g => g.key),
    ...manifest.activities.map(a => a.key),
  ];
  for (const key of all) {
    if (seen.has(key)) fail(`Refusing manifest: duplicate semantic key ${key}`);
    seen.add(key);
  }
}

function requirePerson(key: SemanticKey, personKeys: Set<SemanticKey>): void {
  if (!personKeys.has(key)) fail(`Refusing manifest: unknown semantic key ${key}`);
}

function requireCommunity(key: SemanticKey, communityKeys: Set<SemanticKey>): void {
  if (!communityKeys.has(key)) fail(`Refusing manifest: unknown semantic key ${key}`);
}

function validateReferences(
  manifest: DemoFixtureManifest,
  personKeys: Set<SemanticKey>,
  communityKeys: Set<SemanticKey>,
): void {
  for (const m of manifest.memberships) {
    requirePerson(m.user, personKeys);
    requireCommunity(m.community, communityKeys);
  }
  for (const r of manifest.requests) {
    requirePerson(r.requester, personKeys);
    r.communities.forEach(c => requireCommunity(c, communityKeys));
    if (r.helper) requirePerson(r.helper, personKeys);
  }
  for (const e of manifest.exchanges) {
    requirePerson(e.requester, personKeys);
    requirePerson(e.helper, personKeys);
    requireCommunity(e.community, communityKeys);
  }
  for (const p of manifest.providers) {
    requirePerson(p.user, personKeys);
    requireCommunity(p.community, communityKeys);
  }
  for (const g of manifest.governance) {
    requirePerson(g.proposer, personKeys);
    requireCommunity(g.community, communityKeys);
  }
  for (const a of manifest.activities) {
    requirePerson(a.organizer, personKeys);
    requireCommunity(a.community, communityKeys);
  }
}

function validateMariaMemberOnly(manifest: DemoFixtureManifest): void {
  const maria = manifest.people.find(p => p.key === 'person.maria');
  if (!maria) fail('Refusing manifest: person.maria is required');
  const roles = manifest.memberships.filter(m => m.user === 'person.maria');
  if (roles.length === 0) fail('Refusing manifest: Maria must hold at least one active membership');
  if (roles.some(m => m.role !== 'member')) {
    fail('Refusing manifest: Maria must be member-only and never admin/moderator');
  }
  if (!roles.some(m => m.status === 'active')) {
    fail('Refusing manifest: Maria must have an active membership');
  }
}

function validateCommunityCount(manifest: DemoFixtureManifest): void {
  if (manifest.communities.length !== 6) {
    fail(`Refusing manifest: expected six communities, found ${manifest.communities.length}`);
  }
}

function validatePeopleCount(manifest: DemoFixtureManifest): void {
  const n = manifest.people.length;
  if (n < 30 || n > 40) fail(`Refusing manifest: expected 30–40 people, found ${n}`);
}

function validateActiveCohorts(manifest: DemoFixtureManifest): void {
  for (const community of manifest.communities) {
    const active = manifest.memberships.filter(
      m => m.community === community.key && m.status === 'active',
    ).length;
    if (active < MIN_ACTIVE_MEMBERS_PER_COMMUNITY) {
      fail(`Refusing manifest: community ${community.key} has ${active} active members, needs ${MIN_ACTIVE_MEMBERS_PER_COMMUNITY}`);
    }
  }
}

function validateLifecycles(manifest: DemoFixtureManifest): void {
  for (const r of manifest.requests) {
    if (!VALID_LIFECYCLE.has(r.status)) fail(`Refusing manifest: invalid request lifecycle ${r.status} on ${r.key}`);
  }
}

function findCommunityCreator(manifest: DemoFixtureManifest, community: SemanticKey): SemanticKey {
  const admin = manifest.memberships.find(m => m.community === community && m.role === 'admin');
  if (admin) return admin.user;
  const active = manifest.memberships.find(m => m.community === community && m.status === 'active');
  if (active) return active.user;
  return fail(`Refusing manifest: community ${community} has no creator candidate`);
}
