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
  CompiledEndorsement,
  CompiledEndorsementCount,
  CompiledGovernance,
  CompiledItem,
  CompiledItemShare,
  CompiledMatch,
  CompiledMembership,
  CompiledOffer,
  CompiledPerson,
  CompiledProvider,
  CompiledRequest,
  CompiledSkill,
  CompiledSkillSetting,
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

/**
 * auth.skill_vocabulary (slug -> label), a subset of the INSERT in
 * infrastructure/postgres/migrations/20260930-skill-vocabulary.sql. The arbiter test parses the
 * migrations and fails if a slug here is missing there or its label differs.
 */
export const SKILL_VOCABULARY: Readonly<Record<string, string>> = {
  driving: 'Driving', moving: 'Moving', childcare: 'Childcare', pet_care: 'Pet care',
  tech_support: 'Tech support', coding: 'Coding', home_repair: 'Home repair', handyman: 'Handyman',
  electrical: 'Electrical', plumbing: 'Plumbing', carpentry: 'Carpentry', gardening: 'Gardening',
  cooking: 'Cooking', baking: 'Baking', tutoring: 'Tutoring', languages: 'Languages',
  career_advice: 'Career advice', design: 'Design', writing: 'Writing', photography: 'Photography',
  music: 'Music', art: 'Art', cleaning: 'Cleaning', organizing: 'Organizing',
  elder_care: 'Elder care', bookkeeping: 'Bookkeeping',
};

/** inventory.items CHECK sets (items_category_check / items_condition_check / items_status_check in init.sql). */
export const ITEM_CATEGORIES: ReadonlySet<string> = new Set(
  ['tools', 'electronics', 'kitchen', 'books', 'sports', 'camping', 'party', 'other']);
export const ITEM_CONDITIONS: ReadonlySet<string> = new Set(['fair', 'good', 'like_new', 'new']);
export const ITEM_STATUSES: ReadonlySet<string> = new Set(['available', 'unavailable']);

/** The offer form's type <option>s (apps/frontend/src/pages/offers/new.tsx); help_offers.category has no CHECK. */
export const OFFER_CATEGORIES: ReadonlySet<string> = new Set(
  ['physical_help', 'skills', 'resources', 'emotional_support', 'transportation', 'other']);
/** communities.settings.offer_ttl_days DEFAULT (init.sql). */
export const OFFER_TTL_DAYS = 60;

/**
 * varchar limits of the bounded text columns the seed writes (init.sql): auth.user_tags.tag_value,
 * inventory.items.name, requests.help_offers.title. The arbiter test parses init.sql and compares.
 * The other written columns are enum-bounded (sets above) or have no text column.
 */
export const TEXT_LIMITS: Readonly<{ tagValue: number; itemName: number; offerTitle: number }> = {
  tagValue: 100, itemName: 120, offerTitle: 255,
};
const OFFER_MIN_RUNWAY_DAYS = 30;
const SKILL_CREATED_AGE: FixtureAge = 'P120D';
const ITEM_CREATED_AGE: FixtureAge = 'P30D';

/** The directory's skill_key for free text: lower(regexp_replace(trim(v), '[^a-zA-Z0-9]+', '_', 'g')). */
export function normalizeSkillText(value: string): string {
  return value.replace(/^ +| +$/g, '').replace(/[^a-zA-Z0-9]+/g, '_').toLowerCase();
}

/** The directory key of a skill: its vocabulary slug, else the normalized free text. */
export function skillKey(skill: { skillSlug: string | null; tagValue: string }): string {
  return skill.skillSlug ?? normalizeSkillText(skill.tagValue);
}

/** When an offer created at `createdAt` lapses (communities.settings.offer_ttl_days). */
function offerExpiresAtMs(createdAt: Date): number {
  return createdAt.getTime() + OFFER_TTL_DAYS * DAY_MS;
}

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

  const exchangeByKey = new Map(manifest.exchanges.map(e => [e.key, e]));

  validateUniqueness(manifest);
  validateReferences(manifest, personKeys, communityKeys);
  validateMariaMemberOnly(manifest);
  validateCommunityCount(manifest);
  validatePeopleCount(manifest);
  validateActiveCohorts(manifest);
  validateLifecycles(manifest);
  validateSkillsLayer(manifest, anchor, personKeys, communityKeys, exchangeByKey);

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

  const skillById = new Map<SemanticKey, CompiledSkill>();
  const skills: CompiledSkill[] = manifest.skills.map(sk => {
    const compiled: CompiledSkill = {
      id: semanticUuid(sk.key),
      key: sk.key,
      userId: personIdByKey.get(sk.owner)!,
      tagValue: sk.value,
      skillSlug: sk.slug ?? null,
      createdAt: ageFrom(anchor, SKILL_CREATED_AGE),
    };
    skillById.set(sk.key, compiled);
    return compiled;
  });

  const skillSettings: CompiledSkillSetting[] = manifest.people
    .filter(p => p.shareSkills === false)
    .map(p => ({ userId: personIdByKey.get(p.key)!, shareSkillsWithCommunities: false }));

  const endorsements: CompiledEndorsement[] = manifest.endorsements.map(e => {
    const tag = skillById.get(e.skill)!;
    const exchange = exchangeByKey.get(e.exchange)!;
    const createdAt = ageFrom(anchor, e.createdAge);
    const withdrawnAt = e.withdrawnAge ? ageFrom(anchor, e.withdrawnAge) : null;
    return {
      id: semanticUuid(e.key),
      key: e.key,
      endorserId: personIdByKey.get(e.endorser)!,
      endorseeId: tag.userId,
      userTagId: tag.id,
      matchId: exchangeMatchId(exchange.key),
      communityId: communityIdByKey.get(exchange.community)!,
      createdAt,
      withdrawnAt,
      revision: withdrawnAt ? 2 : 1,
      updatedAt: withdrawnAt ?? createdAt,
    };
  });

  const items: CompiledItem[] = [];
  const itemShares: CompiledItemShare[] = [];
  for (const it of manifest.items) {
    const id = semanticUuid(it.key);
    const createdAt = ageFrom(anchor, ITEM_CREATED_AGE);
    const personal = personKeys.has(it.owner);
    items.push({
      id,
      key: it.key,
      ownerUserId: personal ? personIdByKey.get(it.owner)! : null,
      ownerCommunityId: personal ? null : communityIdByKey.get(it.owner)!,
      name: it.name,
      description: it.description ?? null,
      category: it.category,
      condition: it.condition ?? null,
      status: it.status ?? 'available',
      createdBy: personIdByKey.get(it.createdBy ?? it.owner)!,
      createdAt,
    });
    for (const c of it.sharedWith ?? []) {
      itemShares.push({ itemId: id, communityId: communityIdByKey.get(c)!, sharedAt: createdAt });
    }
  }

  const offers: CompiledOffer[] = manifest.offers.map(o => {
    const createdAt = ageFrom(anchor, o.createdAge);
    return {
      id: semanticUuid(o.key),
      key: o.key,
      communityId: communityIdByKey.get(o.community)!,
      offererId: personIdByKey.get(o.offerer)!,
      title: o.title,
      description: o.description,
      category: o.category,
      status: 'active',
      expired: false,
      createdAt,
      updatedAt: createdAt,
      expiresAt: new Date(offerExpiresAtMs(createdAt)),
    };
  });

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
    skills,
    skillSettings,
    endorsements,
    items,
    itemShares,
    offers,
    endorsementCounts: deriveEndorsementCounts(endorsements),
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
    ...manifest.skills.map(sk => sk.key),
    ...manifest.endorsements.map(e => e.key),
    ...manifest.items.map(i => i.key),
    ...manifest.offers.map(o => o.key),
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

/**
 * The skills layer, validated against the rules the live APIs enforce (ADR-100 endorsements,
 * inventory write rules, POST /offers). Every refusal names the offending fixture key.
 */
function validateSkillsLayer(
  manifest: DemoFixtureManifest,
  anchor: Date,
  personKeys: Set<SemanticKey>,
  communityKeys: Set<SemanticKey>,
  exchangeByKey: Map<string, DemoFixtureManifest['exchanges'][number]>,
): void {
  const activeIn = new Set(
    manifest.memberships.filter(m => m.status === 'active').map(m => `${m.user}|${m.community}`));
  const isActive = (person: SemanticKey, community: SemanticKey) => activeIn.has(`${person}|${community}`);
  const optedOut = new Set(manifest.people.filter(p => p.shareSkills === false).map(p => p.key));

  const skillByKey = new Map<SemanticKey, DemoFixtureManifest['skills'][number]>();
  const tagValues = new Set<string>();
  for (const sk of manifest.skills) {
    requirePerson(sk.owner, personKeys);
    if (sk.slug !== undefined) {
      if (!Object.prototype.hasOwnProperty.call(SKILL_VOCABULARY, sk.slug)) {
        fail(`Refusing manifest: ${sk.key} has unknown skill slug ${sk.slug}`);
      }
      if (sk.value !== SKILL_VOCABULARY[sk.slug]) {
        fail(`Refusing manifest: ${sk.key} value "${sk.value}" must equal the vocabulary label "${SKILL_VOCABULARY[sk.slug]}"`);
      }
    }
    if (sk.value.length === 0 || sk.value.length > TEXT_LIMITS.tagValue) {
      fail(`Refusing manifest: ${sk.key} value must be 1 to ${TEXT_LIMITS.tagValue} characters, found ${sk.value.length}`);
    }
    const tagKey = `${sk.owner}|${sk.value}`;
    if (tagValues.has(tagKey)) fail(`Refusing manifest: ${sk.key} is a duplicate skill value "${sk.value}" for ${sk.owner}`);
    tagValues.add(tagKey);
    skillByKey.set(sk.key, sk);
  }

  const endorsedOnce = new Set<string>();
  for (const e of manifest.endorsements) {
    requirePerson(e.endorser, personKeys);
    const skill = skillByKey.get(e.skill);
    if (!skill) fail(`Refusing manifest: ${e.key} references unknown semantic key ${e.skill}`);
    const exchange = exchangeByKey.get(e.exchange);
    if (!exchange) fail(`Refusing manifest: ${e.key} references unknown semantic key ${e.exchange}`);
    const endorsee = skill.owner;
    if (e.endorser === endorsee) fail(`Refusing manifest: ${e.key} is a self-vouch (endorser is the skill owner)`);
    const pair = [exchange.requester, exchange.helper];
    if (!(pair.includes(e.endorser) && pair.includes(endorsee))) {
      fail(`Refusing manifest: ${e.key} exchange ${e.exchange} is not between the endorser and the endorsee`);
    }
    for (const who of [e.endorser, endorsee]) {
      if (!isActive(who, exchange.community)) {
        fail(`Refusing manifest: ${e.key} ${who} is not an active member of ${exchange.community}`);
      }
    }
    if (optedOut.has(endorsee)) fail(`Refusing manifest: ${e.key} endorsee ${endorsee} has opted out of sharing skills`);
    const createdMs = durationMs(e.createdAge);
    if (createdMs >= durationMs(exchange.completedAge)) {
      fail(`Refusing manifest: ${e.key} is created before its exchange ${e.exchange} completed`);
    }
    if (e.withdrawnAge && durationMs(e.withdrawnAge) >= createdMs) {
      fail(`Refusing manifest: ${e.key} is withdrawn before it was created`);
    }
    const once = `${e.endorser}|${e.skill}`;
    if (endorsedOnce.has(once)) fail(`Refusing manifest: ${e.key} is a duplicate endorsement of ${e.skill} by ${e.endorser}`);
    endorsedOnce.add(once);
  }

  for (const it of manifest.items) {
    if (it.name.length === 0 || it.name.length > TEXT_LIMITS.itemName) {
      fail(`Refusing manifest: ${it.key} name must be 1 to ${TEXT_LIMITS.itemName} characters, found ${it.name.length}`);
    }
    if (!ITEM_CATEGORIES.has(it.category)) fail(`Refusing manifest: ${it.key} has invalid category ${it.category}`);
    if (it.condition !== undefined && !ITEM_CONDITIONS.has(it.condition)) {
      fail(`Refusing manifest: ${it.key} has invalid condition ${it.condition}`);
    }
    if (it.status !== undefined && !ITEM_STATUSES.has(it.status)) fail(`Refusing manifest: ${it.key} has invalid status ${it.status}`);
    const shares = it.sharedWith ?? [];
    shares.forEach(c => requireCommunity(c, communityKeys));
    if (personKeys.has(it.owner)) {
      if (it.createdBy !== undefined) requirePerson(it.createdBy, personKeys);
      shares.forEach(c => {
        if (!isActive(it.owner, c)) fail(`Refusing manifest: ${it.key} is shared to ${c} but ${it.owner} is not an active member`);
      });
      if (new Set(shares).size !== shares.length) {
        const dup = shares.find((c, i) => shares.indexOf(c) !== i);
        fail(`Refusing manifest: ${it.key} has a duplicate share to ${dup}`);
      }
    } else if (communityKeys.has(it.owner)) {
      if (shares.length > 0) fail(`Refusing manifest: ${it.key} is community-owned and cannot be shared`);
      const creator = it.createdBy;
      const admin = creator !== undefined && manifest.memberships.some(
        m => m.user === creator && m.community === it.owner && m.status === 'active' && m.role === 'admin');
      if (!admin) fail(`Refusing manifest: ${it.key} createdBy ${creator ?? '(none)'} is not an active admin of ${it.owner}`);
    } else {
      fail(`Refusing manifest: ${it.key} references unknown semantic key ${it.owner}`);
    }
  }

  for (const o of manifest.offers) {
    requirePerson(o.offerer, personKeys);
    requireCommunity(o.community, communityKeys);
    if (!isActive(o.offerer, o.community)) {
      fail(`Refusing manifest: ${o.key} offerer ${o.offerer} is not an active member of ${o.community}`);
    }
    if (o.title.length === 0 || o.title.length > TEXT_LIMITS.offerTitle) {
      fail(`Refusing manifest: ${o.key} title must be 1 to ${TEXT_LIMITS.offerTitle} characters, found ${o.title.length}`);
    }
    if (!OFFER_CATEGORIES.has(o.category)) fail(`Refusing manifest: ${o.key} has invalid category ${o.category}`);
    const expiresAt = offerExpiresAtMs(ageFrom(anchor, o.createdAge));
    if (expiresAt - anchor.getTime() < OFFER_MIN_RUNWAY_DAYS * DAY_MS) {
      fail(`Refusing manifest: ${o.key} would expire less than ${OFFER_MIN_RUNWAY_DAYS} days after the anchor`);
    }
  }
}

/**
 * Per normalized pair (userIdA < userIdB) and community, the number of distinct endorsers among
 * the two holding at least one non-withdrawn endorsement of the other. Mirrors
 * ENDORSEMENT_TARGETS_SQL in social-graph-service/src/services/endorsementReconcile.ts (0 to 2).
 */
export function deriveEndorsementCounts(endorsements: CompiledEndorsement[]): CompiledEndorsementCount[] {
  const pairs = new Map<string, { userIdA: string; userIdB: string; communityId: string; endorsers: Set<string> }>();
  for (const e of endorsements) {
    if (e.withdrawnAt !== null) continue;
    const [userIdA, userIdB] = e.endorserId < e.endorseeId ? [e.endorserId, e.endorseeId] : [e.endorseeId, e.endorserId];
    const key = `${userIdA}|${userIdB}|${e.communityId}`;
    const entry = pairs.get(key) ?? { userIdA, userIdB, communityId: e.communityId, endorsers: new Set<string>() };
    entry.endorsers.add(e.endorserId);
    pairs.set(key, entry);
  }
  return [...pairs.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, v]) => ({ userIdA: v.userIdA, userIdB: v.userIdB, communityId: v.communityId, count: v.endorsers.size }));
}

/**
 * The `{skill_key -> member_count}` map GET /auth/skills/communities/:id returns to `viewerKey`:
 * per key (the slug, else the normalized free text), the distinct active members of the community
 * holding it who share skills, plus the viewer (an owner always sees their own skills).
 */
export function expectedSkillDirectory(
  baseline: CompiledDemoBaseline,
  communityKey: SemanticKey,
  viewerKey: SemanticKey,
): Record<string, number> {
  const community = baseline.communities.find(c => c.key === communityKey);
  if (!community) fail(`Unknown community ${communityKey}`);
  const viewer = baseline.people.find(p => p.key === viewerKey);
  if (!viewer) fail(`Unknown person ${viewerKey}`);
  if (!baseline.memberships.some(m => m.userId === viewer.id && m.communityId === community.id && m.status === 'active')) {
    fail(`${viewerKey} is not an active member of ${communityKey}; the directory route answers 404`);
  }
  const active = new Set(
    baseline.memberships.filter(m => m.communityId === community.id && m.status === 'active').map(m => m.userId));
  const hidden = new Set(baseline.skillSettings.filter(s => !s.shareSkillsWithCommunities).map(s => s.userId));
  const holders = new Map<string, Set<string>>();
  for (const skill of baseline.skills) {
    if (!active.has(skill.userId)) continue;
    if (hidden.has(skill.userId) && skill.userId !== viewer.id) continue;
    const key = skillKey(skill);
    const set = holders.get(key) ?? new Set<string>();
    set.add(skill.userId);
    holders.set(key, set);
  }
  return Object.fromEntries([...holders.entries()].map(([key, set]) => [key, set.size]));
}
