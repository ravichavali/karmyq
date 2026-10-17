/**
 * Sprint 133 PR D — curated demo seed: skills, the skills-sharing opt-out, endorsements, items and
 * standing offers (plan docs/superpowers/plans/2026-10-16-sprint-133-pr-d-demo-seed.md, Task D1).
 *
 * These tests are the interface contract for Tasks D2–D5. They cover:
 *  - the compiled manifest's content RULES and fixed facts (the seven endorsement keys and pairs,
 *    the opt-out person, the Tool Library items, the three standing offers);
 *  - `deriveEndorsementCounts`, asserted by pair identity against PR B's reconcile rule
 *    (distinct non-withdrawn endorsers per normalized pair and community, 0..2);
 *  - fail-closed compilation: one planted violation per rule, each on an otherwise valid manifest,
 *    with the thrown message naming the offending semantic key;
 *  - the baseline writer's statement order and `applyEndorsementCounts`'s rowCount guard;
 *  - `expectedSkillDirectory`, and the verifier's `skillsVisible` / `offerBoundary` checks;
 *  - the api-client `listOffers` / `getOffer` reads the verifier uses.
 */

import axios from 'axios';
import type { PoolClient } from 'pg';
import { ApiClient } from '../../src/api-client';
import {
  CURATED_DEMO_MANIFEST,
  compileManifest,
  deriveEndorsementCounts,
  exchangeMatchId,
  expectedSkillDirectory,
  OFFER_TTL_DAYS,
  semanticUuid,
  SKILL_VOCABULARY,
} from '../../src/fixtures/curatedDemo/compiler';
import { applyEndorsementCounts, writeBaseline } from '../../src/fixtures/curatedDemo/baselineWriter';
import type { ClassifiedTableSet } from '../../src/fixtures/curatedDemo/tablePolicy';
import {
  verifyCuratedDemo,
  type ApiRead,
  type DemoVerificationDeps,
  type DemoViewer,
  type MemberSkillView,
  type OfferView,
  type SkillDirectoryEntry,
  type SkillSearchRow,
} from '../../src/fixtures/curatedDemo/verifier';
import type {
  CompiledDemoBaseline,
  CompiledEndorsement,
  CompiledEndorsementCount,
  DemoFixtureManifest,
  EndorsementFixture,
  FixtureAge,
  ItemFixture,
  OfferFixture,
  SkillFixture,
} from '../../src/fixtures/curatedDemo/types';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const ANCHOR = new Date('2026-10-20T12:00:00.000Z');
const LATER = new Date('2027-01-15T09:30:00.000Z');
const DAY_MS = 86_400_000;

const id = (key: string): string => semanticUuid(key);

// People (manifest.ts:36-71) and communities (manifest.ts:74-81).
const MARIA = 'person.maria';
const ELENA = 'person.helper';
const FATIMA = 'person.helper-exclusive';
const SOPHIA = 'person.shared-sophia';
const JAMES = 'person.shared-james';
const PRIYA = 'person.shared-priya';
const WEI = 'person.maria-exclusive';
const AMINA = 'person.bridge';
const NOAH = 'person.provider';
const TOOLS_ADMIN = 'person.steward-tools';
const OUTSIDER = 'person.outsider';
const OPT_OUT = 'person.ambient-09';
const RIDES_OFFERER = 'person.ambient-13';

const PMA = 'community.portland-mutual-aid';
const SE_PDX = 'community.southeast-pdx';
const TOOL_LIBRARY = 'community.tool-library';
const PROVIDERS = 'community.providers';
const RIDES = 'community.rides';

/** The seven story endorsements (plan, Seed content). Endorsee = owner of the endorsed skill. */
const ENDORSEMENTS: Record<string, { endorser: string; endorsee: string; exchange: string; community: string; withdrawn: boolean; slug?: string }> = {
  'endorsement.sophia-maria-cooking': { endorser: SOPHIA, endorsee: MARIA, exchange: 'exchange.maria-sophia-4', community: PMA, withdrawn: false, slug: 'cooking' },
  'endorsement.maria-sophia-tutoring': { endorser: MARIA, endorsee: SOPHIA, exchange: 'exchange.maria-sophia-3', community: PMA, withdrawn: false, slug: 'tutoring' },
  'endorsement.wei-maria-cooking': { endorser: WEI, endorsee: MARIA, exchange: 'exchange.maria-wei-2', community: PMA, withdrawn: false, slug: 'cooking' },
  'endorsement.james-maria-driving': { endorser: JAMES, endorsee: MARIA, exchange: 'exchange.maria-james-2', community: PMA, withdrawn: true, slug: 'driving' },
  'endorsement.helper-fatima': { endorser: ELENA, endorsee: FATIMA, exchange: 'exchange.helper-fatima-1', community: SE_PDX, withdrawn: false },
  'endorsement.fatima-helper': { endorser: FATIMA, endorsee: ELENA, exchange: 'exchange.helper-fatima-2', community: SE_PDX, withdrawn: false },
  'endorsement.amina-noah-handyman': { endorser: AMINA, endorsee: NOAH, exchange: 'exchange.amina-provider-1', community: PROVIDERS, withdrawn: false, slug: 'handyman' },
};

const OFFERS: Record<string, { offerer: string; community: string }> = {
  'offer.sophia-meal-prep': { offerer: SOPHIA, community: PMA },
  'offer.priya-tutoring': { offerer: PRIYA, community: PMA },
  'offer.rides-airport': { offerer: RIDES_OFFERER, community: RIDES },
};

function compile(manifest: DemoFixtureManifest = CURATED_DEMO_MANIFEST, anchor: Date = ANCHOR): CompiledDemoBaseline {
  return compileManifest(manifest, anchor);
}

/** The key the live skill directory groups by: `COALESCE(skill_slug, normalized tag_value)` (auth-service routes/skills.ts:11-12). */
function directoryKey(skill: { skillSlug: string | null; tagValue: string }): string {
  return skill.skillSlug ?? skill.tagValue.trim().replace(/[^a-zA-Z0-9]+/g, '_').toLowerCase();
}

function normalizeSearchText(text: string): string {
  return text.trim().replace(/[^a-zA-Z0-9]+/g, '_').toLowerCase();
}

function pairKey(a: string, b: string, community: string): string {
  const [x, y] = a < b ? [a, b] : [b, a];
  return `${x}|${y}|${community}`;
}

function activeMemberKeys(manifest: DemoFixtureManifest, person: string): Set<string> {
  return new Set(manifest.memberships.filter(m => m.user === person && m.status === 'active').map(m => m.community));
}

function ageHours(age: FixtureAge): number {
  const m = /^(?:P(\d+)D|PT(\d+)H)$/.exec(age);
  if (!m) throw new Error(`bad age ${age}`);
  return Number(m[1] ?? 0) * 24 + Number(m[2] ?? 0);
}

function sharedSkillKeys(baseline: CompiledDemoBaseline, a: string, b: string): string[] {
  const keysOf = (person: string) => new Set<string>(baseline.skills.filter(s => s.userId === id(person)).map(directoryKey));
  const bKeys = keysOf(b);
  return [...keysOf(a)].filter(k => bKeys.has(k)).sort();
}

// --- manifest patch helpers: each planted violation edits exactly one thing on the valid manifest ---

function patchEndorsement(key: string, patch: Partial<EndorsementFixture>): DemoFixtureManifest {
  const target = CURATED_DEMO_MANIFEST.endorsements.find(e => e.key === key);
  expect(target).toBeDefined();
  return { ...CURATED_DEMO_MANIFEST, endorsements: CURATED_DEMO_MANIFEST.endorsements.map(e => (e.key === key ? { ...e, ...patch } : e)) };
}

function patchSkill(key: string, patch: Partial<SkillFixture>): DemoFixtureManifest {
  return { ...CURATED_DEMO_MANIFEST, skills: CURATED_DEMO_MANIFEST.skills.map(s => (s.key === key ? { ...s, ...patch } : s)) };
}

function patchItem(key: string, patch: Partial<ItemFixture>): DemoFixtureManifest {
  return { ...CURATED_DEMO_MANIFEST, items: CURATED_DEMO_MANIFEST.items.map(i => (i.key === key ? { ...i, ...patch } : i)) };
}

function patchOffer(key: string, patch: Partial<OfferFixture>): DemoFixtureManifest {
  const target = CURATED_DEMO_MANIFEST.offers.find(o => o.key === key);
  expect(target).toBeDefined();
  return { ...CURATED_DEMO_MANIFEST, offers: CURATED_DEMO_MANIFEST.offers.map(o => (o.key === key ? { ...o, ...patch } : o)) };
}

const endorsedSkillKeys = (): Set<string> => new Set(CURATED_DEMO_MANIFEST.endorsements.map(e => e.skill));
const personKeys = (): Set<string> => new Set(CURATED_DEMO_MANIFEST.people.map(p => p.key));

function personalSharedItem(): ItemFixture {
  const people = personKeys();
  const item = CURATED_DEMO_MANIFEST.items.find(i => people.has(i.owner) && (i.sharedWith ?? []).length > 0);
  expect(item).toBeDefined();
  return item!;
}

function communityItem(): ItemFixture {
  const item = CURATED_DEMO_MANIFEST.items.find(i => i.owner === TOOL_LIBRARY);
  expect(item).toBeDefined();
  return item!;
}

function unendorsedSkill(predicate: (s: SkillFixture) => boolean): SkillFixture {
  const endorsed = endorsedSkillKeys();
  const skill = CURATED_DEMO_MANIFEST.skills.find(s => !endorsed.has(s.key) && predicate(s));
  expect(skill).toBeDefined();
  return skill!;
}

// ---------------------------------------------------------------------------
// Compiled manifest content
// ---------------------------------------------------------------------------

describe('Sprint 133 PR D: compiled curated seed content', () => {
  const baseline = compile();
  const skillsOf = (person: string) => baseline.skills.filter(s => s.userId === id(person));
  const endorsementByKey = new Map(baseline.endorsements.map(e => [e.key, e]));
  const completedAtByExchange = new Map(baseline.projectionEvents.map(e => [e.key, e.completedAt]));

  it('compiles the unmodified manifest (the control every planted violation below is measured against)', () => {
    expect(() => compile()).not.toThrow();
  });

  it('gives every skill a stable semantic id, a skill. key, a <= 100 char value, and a vocabulary label when slugged', () => {
    expect(baseline.skills.length).toBe(CURATED_DEMO_MANIFEST.skills.length);
    for (const skill of baseline.skills) {
      expect(skill.key.startsWith('skill.')).toBe(true);
      expect(skill.id).toBe(semanticUuid(skill.key));
      expect(skill.tagValue.length).toBeLessThanOrEqual(100);
      if (skill.skillSlug !== null) expect(skill.tagValue).toBe(SKILL_VOCABULARY[skill.skillSlug]);
    }
    const perOwnerValue = baseline.skills.map(s => `${s.userId}|${s.tagValue}`);
    expect(new Set(perOwnerValue).size).toBe(perOwnerValue.length);
    // Decision 2: vocabulary slugs plus a couple of deliberate free-text tags.
    expect(baseline.skills.some(s => s.skillSlug === null)).toBe(true);
  });

  it('gives Maria at least 3 skills and at least one active vouch; her cooking skill shows exactly 2', () => {
    expect(skillsOf(MARIA).length).toBeGreaterThanOrEqual(3);
    const activeOnMaria = baseline.endorsements.filter(e => e.endorseeId === id(MARIA) && e.withdrawnAt === null);
    expect(activeOnMaria.length).toBeGreaterThanOrEqual(1);
    const cooking = skillsOf(MARIA).filter(s => s.skillSlug === 'cooking');
    expect(cooking).toHaveLength(1);
    const cookingVouches = baseline.endorsements.filter(e => e.userTagId === cooking[0].id && e.withdrawnAt === null);
    expect(cookingVouches.map(e => e.key).sort()).toEqual(['endorsement.sophia-maria-cooking', 'endorsement.wei-maria-cooking']);
  });

  it('gives every person who helped in a seeded exchange 2 to 4 skills', () => {
    const helpers = [...new Set(CURATED_DEMO_MANIFEST.exchanges.map(e => e.helper))];
    expect(helpers.length).toBeGreaterThan(0);
    for (const helper of helpers) {
      const n = skillsOf(helper).length;
      expect({ helper, n, ok: n >= 2 && n <= 4 }).toEqual({ helper, n, ok: true });
    }
  });

  it('opts exactly one person out (ambient-09): it holds a skill, has no endorsements, and shares skill X with Amina', () => {
    expect(CURATED_DEMO_MANIFEST.people.filter(p => p.shareSkills === false).map(p => p.key)).toEqual([OPT_OUT]);
    expect(baseline.skillSettings).toEqual([{ userId: id(OPT_OUT), shareSkillsWithCommunities: false }]);
    expect(skillsOf(OPT_OUT).length).toBeGreaterThanOrEqual(1);
    expect(baseline.endorsements.filter(e => e.endorserId === id(OPT_OUT) || e.endorseeId === id(OPT_OUT))).toEqual([]);
    // Critical Note 9: the opt-out is proven by search for X, with Amina as the positive control.
    expect(sharedSkillKeys(baseline, OPT_OUT, AMINA).length).toBeGreaterThanOrEqual(1);
    expect(activeMemberKeys(CURATED_DEMO_MANIFEST, OPT_OUT).has(PROVIDERS)).toBe(true);
    expect(activeMemberKeys(CURATED_DEMO_MANIFEST, AMINA).has(PROVIDERS)).toBe(true);
  });

  it('seeds exactly the seven story endorsements, by key, pair, exchange and community, one of them withdrawn', () => {
    expect(baseline.endorsements.map(e => e.key).sort()).toEqual(Object.keys(ENDORSEMENTS).sort());
    for (const [key, want] of Object.entries(ENDORSEMENTS)) {
      const e = endorsementByKey.get(key)!;
      const skill = baseline.skills.find(s => s.id === e.userTagId)!;
      expect({
        key, id: e.id, endorser: e.endorserId, endorsee: e.endorseeId, skillOwner: skill.userId,
        matchId: e.matchId, community: e.communityId, withdrawn: e.withdrawnAt !== null, revision: e.revision,
      }).toEqual({
        key, id: semanticUuid(key), endorser: id(want.endorser), endorsee: id(want.endorsee), skillOwner: id(want.endorsee),
        matchId: exchangeMatchId(want.exchange), community: id(want.community), withdrawn: want.withdrawn, revision: want.withdrawn ? 2 : 1,
      });
      if (want.slug) expect(skill.skillSlug).toBe(want.slug);
    }
    expect(baseline.endorsements.filter(e => e.withdrawnAt !== null).map(e => e.key)).toEqual(['endorsement.james-maria-driving']);
  });

  it('dates every vouch after its exchange and before the anchor, and every withdrawal after its vouch', () => {
    for (const fixture of CURATED_DEMO_MANIFEST.endorsements) {
      const e = endorsementByKey.get(fixture.key)!;
      const completedAt = completedAtByExchange.get(fixture.exchange)!;
      expect(completedAt).toBeInstanceOf(Date);
      expect(e.createdAt.getTime()).toBeGreaterThan(completedAt.getTime());
      expect(e.createdAt.getTime()).toBeLessThanOrEqual(ANCHOR.getTime());
      if (e.withdrawnAt) {
        expect(e.withdrawnAt.getTime()).toBeGreaterThan(e.createdAt.getTime());
        expect(e.withdrawnAt.getTime()).toBeLessThanOrEqual(ANCHOR.getTime());
      }
    }
  });

  it('shares every personal item only within its owner\'s active memberships, and creates it as the owner', () => {
    const people = personKeys();
    const personal = CURATED_DEMO_MANIFEST.items.filter(i => people.has(i.owner));
    // Decision 4: five or six personal items, each shared to its owner's communities.
    expect(personal.length).toBeGreaterThanOrEqual(5);
    expect(personal.length).toBeLessThanOrEqual(6);
    for (const fixture of personal) {
      const item = baseline.items.find(i => i.key === fixture.key)!;
      expect(item.id).toBe(semanticUuid(fixture.key));
      expect(item.ownerUserId).toBe(id(fixture.owner));
      expect(item.ownerCommunityId).toBeNull();
      expect(item.createdBy).toBe(id(fixture.owner));
      const shares = baseline.itemShares.filter(s => s.itemId === item.id).map(s => s.communityId).sort();
      expect(shares.length).toBeGreaterThanOrEqual(1);
      const allowed = new Set([...activeMemberKeys(CURATED_DEMO_MANIFEST, fixture.owner)].map(id));
      expect(shares.filter(c => !allowed.has(c))).toEqual([]);
      expect(shares).toEqual([...new Set((fixture.sharedWith ?? []).map(id))].sort());
    }
  });

  it('seeds exactly four Tool Library items, owned by the community, created by its admin, never shared', () => {
    const owned = baseline.items.filter(i => i.ownerCommunityId === id(TOOL_LIBRARY));
    expect(owned).toHaveLength(4);
    for (const item of owned) {
      expect(item.ownerUserId).toBeNull();
      expect(item.createdBy).toBe(id(TOOLS_ADMIN));
      expect(baseline.itemShares.filter(s => s.itemId === item.id)).toEqual([]);
    }
    expect(baseline.items.filter(i => i.ownerCommunityId !== null)).toHaveLength(4);
  });

  it('seeds exactly three active standing offers: two in Portland Mutual Aid, one in PDX Rides Collective, each live 30+ days', () => {
    expect(baseline.offers.map(o => o.key).sort()).toEqual(Object.keys(OFFERS).sort());
    for (const [key, want] of Object.entries(OFFERS)) {
      const offer = baseline.offers.find(o => o.key === key)!;
      expect({ id: offer.id, offerer: offer.offererId, community: offer.communityId, status: offer.status, expired: offer.expired })
        .toEqual({ id: semanticUuid(key), offerer: id(want.offerer), community: id(want.community), status: 'active', expired: false });
      expect(offer.updatedAt.getTime()).toBe(offer.createdAt.getTime());
      expect(offer.expiresAt.getTime() - offer.createdAt.getTime()).toBe(OFFER_TTL_DAYS * DAY_MS);
      expect(offer.expiresAt.getTime() - ANCHOR.getTime()).toBeGreaterThanOrEqual(30 * DAY_MS);
    }
    // Maria is a member of Portland Mutual Aid and not of PDX Rides Collective (the boundary story).
    expect(activeMemberKeys(CURATED_DEMO_MANIFEST, MARIA).has(PMA)).toBe(true);
    expect(activeMemberKeys(CURATED_DEMO_MANIFEST, MARIA).has(RIDES)).toBe(false);
    expect(activeMemberKeys(CURATED_DEMO_MANIFEST, OUTSIDER).has(RIDES)).toBe(true);
  });

  it('keeps the new ids stable across anchors and shifts every new timestamp by exactly the anchor delta', () => {
    const later = compile(CURATED_DEMO_MANIFEST, LATER);
    const delta = LATER.getTime() - ANCHOR.getTime();
    const shift = (a: Date | null, b: Date | null) => (a === null || b === null ? (a === b ? 0 : NaN) : b.getTime() - a.getTime());
    expect(later.skills.map(s => s.id)).toEqual(baseline.skills.map(s => s.id));
    expect(later.endorsements.map(e => e.id)).toEqual(baseline.endorsements.map(e => e.id));
    expect(later.items.map(i => i.id)).toEqual(baseline.items.map(i => i.id));
    expect(later.offers.map(o => o.id)).toEqual(baseline.offers.map(o => o.id));
    baseline.endorsements.forEach((e, i) => {
      expect(shift(e.createdAt, later.endorsements[i].createdAt)).toBe(delta);
      if (e.withdrawnAt) expect(shift(e.withdrawnAt, later.endorsements[i].withdrawnAt)).toBe(delta);
    });
    baseline.offers.forEach((o, i) => {
      expect(shift(o.createdAt, later.offers[i].createdAt)).toBe(delta);
      expect(shift(o.expiresAt, later.offers[i].expiresAt)).toBe(delta);
    });
  });
});

// ---------------------------------------------------------------------------
// Derived endorsement counts (Critical Note 2: PR B's ENDORSEMENT_TARGETS_SQL)
// ---------------------------------------------------------------------------

describe('Sprint 133 PR D: deriveEndorsementCounts', () => {
  const asMap = (counts: CompiledEndorsementCount[]) => {
    const map: Record<string, number> = {};
    for (const c of counts) {
      const k = `${c.userIdA}|${c.userIdB}|${c.communityId}`;
      expect(map[k]).toBeUndefined(); // one entry per normalized pair and community
      expect(c.userIdA < c.userIdB).toBe(true); // the trust_edges order
      map[k] = c.count;
    }
    return map;
  };
  const nonZero = (map: Record<string, number>) => Object.fromEntries(Object.entries(map).filter(([, n]) => n !== 0));

  it('returns exactly the reconciled pair counts for the seeded manifest, keyed by normalized ids', () => {
    const baseline = compile();
    const derived = asMap(deriveEndorsementCounts(baseline.endorsements));
    expect(nonZero(derived)).toEqual({
      [pairKey(id(MARIA), id(SOPHIA), id(PMA))]: 2,
      [pairKey(id(MARIA), id(WEI), id(PMA))]: 1,
      [pairKey(id(ELENA), id(FATIMA), id(SE_PDX))]: 2,
      [pairKey(id(AMINA), id(NOAH), id(PROVIDERS))]: 1,
    });
    // Maria-James: the only vouch is withdrawn, so the pair is 0 or absent, never positive.
    expect(derived[pairKey(id(MARIA), id(JAMES), id(PMA))] ?? 0).toBe(0);
    expect(baseline.endorsementCounts).toEqual(deriveEndorsementCounts(baseline.endorsements));
  });

  it('counts distinct endorsers, not vouches: one endorser vouching two skills counts once; both directions count 2', () => {
    const a = id('person.unit-a');
    const b = id('person.unit-b');
    const c = id('community.unit');
    const [lo, hi] = a < b ? [a, b] : [b, a];
    const e = (key: string, endorserId: string, endorseeId: string, withdrawn = false): CompiledEndorsement => ({
      id: semanticUuid(key), key, endorserId, endorseeId, userTagId: semanticUuid(`${key}.tag`),
      matchId: semanticUuid(`${key}.match`), communityId: c, createdAt: ANCHOR, withdrawnAt: withdrawn ? ANCHOR : null,
      revision: withdrawn ? 2 : 1,
    } as CompiledEndorsement);
    const oneWayTwoSkills = asMap(deriveEndorsementCounts([e('e.1', a, b), e('e.2', a, b)]));
    expect(nonZero(oneWayTwoSkills)).toEqual({ [`${lo}|${hi}|${c}`]: 1 });
    const bothWays = asMap(deriveEndorsementCounts([e('e.1', a, b), e('e.2', a, b), e('e.3', b, a)]));
    expect(nonZero(bothWays)).toEqual({ [`${lo}|${hi}|${c}`]: 2 });
    const withdrawnOnly = asMap(deriveEndorsementCounts([e('e.1', a, b, true)]));
    expect(nonZero(withdrawnOnly)).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// Fail-closed compiler: one planted violation per rule (Critical Notes 1, 6, 8, 11)
//
// Each refusal must name the offending fixture's key AND say which rule it broke. The rule
// fragments below are the contract D3's messages conform to (case-insensitive):
//   exchange not between the pair  -> "not between"        self-vouch            -> "self"
//   party not an active member     -> "not an active member" endorsee opted out  -> "opted out"
//   duplicate (endorser, skill) / duplicate tag value -> "duplicate"
//   vouch older than its exchange  -> "before its exchange" withdrawal before vouch -> "withdrawn before"
//   unknown slug -> "unknown skill slug"   slugged value != label -> "vocabulary label"
//   value > 100 chars -> "100 characters"  shared community item -> "community-owned"
//   community item creator not admin -> "not an active admin"
//   item/offer enum outside its set -> "invalid category" | "invalid condition" | "invalid status"
//   offer expiring within 30 days of the anchor -> "30 days"
// ---------------------------------------------------------------------------

/** Compile must throw, and the message must carry both the key and the rule's wording. */
function expectRefusal(manifest: DemoFixtureManifest, key: string, rule: RegExp): void {
  let message: string | null = null;
  try {
    compile(manifest);
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }
  expect(message).not.toBeNull();
  expect(message).toContain(key);
  expect(message).toMatch(rule);
}

describe('Sprint 133 PR D: the compiler refuses an invalid seed, naming the key and the rule', () => {
  // Critical Note 1: endorsements follow the live API's write rule (ADR-100).
  it('refuses a vouch whose named exchange is not between the pair', () => {
    // maria-sophia-4 is a real completed exchange in the same community; Wei is simply not a party.
    expectRefusal(patchEndorsement('endorsement.wei-maria-cooking', { exchange: 'exchange.maria-sophia-4' }),
      'endorsement.wei-maria-cooking', /not between/i);
  });

  describe('a vouch whose endorser has left the exchange community', () => {
    // Collateral: Wei's own items are dropped, since leaving PMA would also strand their shares.
    const withoutWeiItems = (): DemoFixtureManifest => ({
      ...CURATED_DEMO_MANIFEST,
      items: CURATED_DEMO_MANIFEST.items.filter(i => i.owner !== WEI),
    });

    it('control: the collateral mutation alone compiles cleanly', () => {
      expect(() => compile(withoutWeiItems())).not.toThrow();
    });

    it('is refused once Wei leaves Portland Mutual Aid', () => {
      expect(CURATED_DEMO_MANIFEST.memberships.some(m => m.user === WEI && m.community === PMA && m.status === 'active')).toBe(true);
      const base = withoutWeiItems();
      const left: DemoFixtureManifest = {
        ...base,
        memberships: base.memberships.map(m => (m.user === WEI && m.community === PMA ? { ...m, status: 'left' as const } : m)),
      };
      expectRefusal(left, 'endorsement.wei-maria-cooking', /not an active member/i);
    });
  });

  it('refuses a vouch for an endorsee who opted out of sharing skills', () => {
    const optedOut: DemoFixtureManifest = {
      ...CURATED_DEMO_MANIFEST,
      people: CURATED_DEMO_MANIFEST.people.map(p => (p.key === SOPHIA ? { ...p, shareSkills: false as const } : p)),
    };
    expectRefusal(optedOut, 'endorsement.maria-sophia-tutoring', /opted out/i);
  });

  it('refuses a self-vouch as a self-vouch', () => {
    // A self-vouch cannot have an exchange "between" one person, so the pair rule could also fire.
    // The wording pins the reason: the compiler must report the self-vouch, checked first.
    expectRefusal(patchEndorsement('endorsement.sophia-maria-cooking', { endorser: MARIA }),
      'endorsement.sophia-maria-cooking', /self/i);
  });

  it('refuses a second vouch by the same endorser on the same skill', () => {
    const original = CURATED_DEMO_MANIFEST.endorsements.find(e => e.key === 'endorsement.sophia-maria-cooking')!;
    // Otherwise valid: maria-sophia-2 (P120D) is between the pair in PMA, and P100D is after it.
    const dup: DemoFixtureManifest = {
      ...CURATED_DEMO_MANIFEST,
      endorsements: [
        ...CURATED_DEMO_MANIFEST.endorsements,
        { ...original, key: 'endorsement.sophia-maria-cooking-dup', exchange: 'exchange.maria-sophia-2', createdAge: 'P100D' },
      ],
    };
    expectRefusal(dup, 'endorsement.sophia-maria-cooking-dup', /duplicate/i);
  });

  it('refuses a vouch older than its exchange', () => {
    // exchange.maria-sophia-4 completed P12D before the anchor (manifest.ts:207).
    expectRefusal(patchEndorsement('endorsement.sophia-maria-cooking', { createdAge: 'P13D' }),
      'endorsement.sophia-maria-cooking', /before its exchange/i);
  });

  it('refuses a withdrawal dated before its vouch', () => {
    const james = CURATED_DEMO_MANIFEST.endorsements.find(e => e.key === 'endorsement.james-maria-driving')!;
    const before = `PT${ageHours(james.createdAge) + 24}H` as FixtureAge;
    expectRefusal(patchEndorsement('endorsement.james-maria-driving', { withdrawnAge: before }),
      'endorsement.james-maria-driving', /withdrawn before/i);
  });

  // Critical Note 6: skills.
  it('refuses a skill slug that is not in the vocabulary', () => {
    const skill = unendorsedSkill(s => s.slug !== undefined);
    expectRefusal(patchSkill(skill.key, { slug: 'not_a_vocabulary_slug' }), skill.key, /unknown skill slug/i);
  });

  it('refuses a slugged skill whose value is not the vocabulary label', () => {
    const skill = unendorsedSkill(s => s.slug !== undefined);
    expectRefusal(patchSkill(skill.key, { value: 'Not the vocabulary label' }), skill.key, /vocabulary label/i);
  });

  it('refuses a skill value longer than 100 characters', () => {
    const skill = unendorsedSkill(s => s.slug === undefined);
    expectRefusal(patchSkill(skill.key, { value: 'x'.repeat(101) }), skill.key, /100 characters/i);
  });

  it('refuses a duplicate tag value for one person', () => {
    const skill = CURATED_DEMO_MANIFEST.skills[0];
    const dup: DemoFixtureManifest = {
      ...CURATED_DEMO_MANIFEST,
      skills: [...CURATED_DEMO_MANIFEST.skills, { ...skill, key: 'skill.planted-duplicate' }],
    };
    expectRefusal(dup, 'skill.planted-duplicate', /duplicate/i);
  });

  // Critical Note 8: items follow inventory's write rules.
  it('refuses a personal item shared to a community its owner does not actively belong to', () => {
    const item = personalSharedItem();
    const member = activeMemberKeys(CURATED_DEMO_MANIFEST, item.owner);
    const foreign = CURATED_DEMO_MANIFEST.communities.map(c => c.key).find(c => !member.has(c))!;
    expect(foreign).toBeDefined();
    expectRefusal(patchItem(item.key, { sharedWith: [...(item.sharedWith ?? []), foreign] }), item.key, /not an active member/i);
  });

  it('refuses a shared community-owned item', () => {
    const item = communityItem();
    expectRefusal(patchItem(item.key, { sharedWith: [TOOL_LIBRARY] }), item.key, /community-owned/i);
  });

  it('refuses a community item created by a member who is not an active admin', () => {
    const item = communityItem();
    // James is an active plain member of the Tool Library (manifest.ts:115-122).
    expectRefusal(patchItem(item.key, { createdBy: JAMES }), item.key, /not an active admin/i);
  });

  it.each([
    ['category', { category: 'not_a_category' }, /invalid category/i],
    ['condition', { condition: 'not_a_condition' }, /invalid condition/i],
    ['status', { status: 'not_a_status' }, /invalid status/i],
  ] as Array<[string, Partial<ItemFixture>, RegExp]>)('refuses an item %s outside the CHECK set', (_field, patch, rule) => {
    const item = personalSharedItem();
    expectRefusal(patchItem(item.key, patch), item.key, rule);
  });

  it('refuses an item name over the varchar limit or empty (database must never reject first)', () => {
    const item = personalSharedItem();
    expectRefusal(patchItem(item.key, { name: 'x'.repeat(121) }), item.key, /name must be 1 to 120 characters/i);
    expectRefusal(patchItem(item.key, { name: '' }), item.key, /name must be 1 to 120 characters/i);
    expect(() => compile(patchItem(item.key, { name: 'x'.repeat(120) }))).not.toThrow();
  });

  it('refuses an offer title over the varchar limit or empty', () => {
    const key = 'offer.sophia-meal-prep';
    expectRefusal(patchOffer(key, { title: 'x'.repeat(256) }), key, /title must be 1 to 255 characters/i);
    expectRefusal(patchOffer(key, { title: '' }), key, /title must be 1 to 255 characters/i);
    expect(() => compile(patchOffer(key, { title: 'x'.repeat(255) }))).not.toThrow();
  });

  // Critical Note 11: offers follow POST /offers's write rule.
  it('refuses an offer by someone who is not an active member of its community', () => {
    expectRefusal(patchOffer('offer.rides-airport', { offerer: MARIA }), 'offer.rides-airport', /not an active member/i);
  });

  it('refuses an offer category outside the offer form\'s set', () => {
    expectRefusal(patchOffer('offer.sophia-meal-prep', { category: 'not_a_category' }), 'offer.sophia-meal-prep', /invalid category/i);
  });

  it('refuses an offer expiring less than 30 days after the anchor, and accepts exactly 30', () => {
    // expires_at = created_at + OFFER_TTL_DAYS: created P31D ago -> 29 days left; P30D ago -> exactly 30.
    expect(OFFER_TTL_DAYS).toBe(60);
    expectRefusal(patchOffer('offer.priya-tutoring', { createdAge: 'P31D' }), 'offer.priya-tutoring', /30 days/i);
    expect(() => compile(patchOffer('offer.priya-tutoring', { createdAge: 'P30D' }))).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Baseline writer (Critical Notes 3 and 5)
// ---------------------------------------------------------------------------

interface RecordedCall { sql: string; params: unknown[] }

// Deliberately not the reseeded 10/5/3/2: the count UPDATE must carry what the weights read returned.
const WEIGHT_ROWS = [
  { community_id: null, interaction_type: 'match_completed', weight: 10.5 },
  { community_id: null, interaction_type: 'endorsement', weight: 5.5 },
  { community_id: null, interaction_type: 'karma_given', weight: 3.5 },
  { community_id: null, interaction_type: 'event', weight: 2.5 },
];

const isCountUpdate = (sql: string) => /UPDATE\s+social_graph\.trust_edges/i.test(sql) && /endorsement_count/i.test(sql);
const isWeightsRead = (sql: string) => /^\s*SELECT/i.test(sql) && /social_graph\.interaction_weights/i.test(sql);

function recordingClient(countRowCount = 1): { client: PoolClient; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const query = async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    if (isWeightsRead(sql)) return { rows: WEIGHT_ROWS, rowCount: WEIGHT_ROWS.length };
    if (isCountUpdate(sql)) return { rows: [], rowCount: countRowCount };
    return { rows: [], rowCount: 1 };
  };
  return { client: { query } as unknown as PoolClient, calls };
}

const NO_TABLES: ClassifiedTableSet = { reset: [], reseed: [], preserve: [] };

function flatParams(calls: RecordedCall[], table: RegExp): unknown[] {
  const flat = (v: unknown): unknown[] => (Array.isArray(v) ? v.flatMap(flat) : [v]);
  return calls.filter(c => table.test(c.sql)).flatMap(c => c.params.flatMap(flat));
}

describe('Sprint 133 PR D: baseline writer', () => {
  const baseline = compile();
  const first = (calls: RecordedCall[], re: RegExp) => calls.findIndex(c => re.test(c.sql));
  const last = (calls: RecordedCall[], re: RegExp) => calls.map(c => re.test(c.sql)).lastIndexOf(true);

  it('inserts skills, the opt-out, endorsements, items, shares and offers in FK order', async () => {
    const { client, calls } = recordingClient();
    await writeBaseline(client, baseline, NO_TABLES, '$2a$12$hash');

    const order = {
      users: last(calls, /INSERT INTO auth\.users\b/i),
      memberships: last(calls, /INSERT INTO communities\.members\b/i),
      matches: last(calls, /INSERT INTO requests\.matches\b/i),
      tagsFirst: first(calls, /INSERT INTO auth\.user_tags\b/i),
      tagsLast: last(calls, /INSERT INTO auth\.user_tags\b/i),
      privacy: first(calls, /INSERT INTO auth\.user_privacy_settings\b/i),
      endorsements: first(calls, /INSERT INTO auth\.skill_endorsements\b/i),
      itemsFirst: first(calls, /INSERT INTO inventory\.items\b/i),
      itemsLast: last(calls, /INSERT INTO inventory\.items\b/i),
      shares: first(calls, /INSERT INTO inventory\.item_shares\b/i),
      offers: first(calls, /INSERT INTO requests\.help_offers\b/i),
    };
    for (const [name, index] of Object.entries(order)) expect({ name, present: index >= 0 }).toEqual({ name, present: true });
    expect(order.tagsFirst).toBeGreaterThan(order.users);
    expect(order.privacy).toBeGreaterThan(order.users);
    expect(order.endorsements).toBeGreaterThan(order.matches);
    expect(order.endorsements).toBeGreaterThan(order.tagsLast);
    expect(order.itemsFirst).toBeGreaterThan(order.memberships);
    expect(order.shares).toBeGreaterThan(order.itemsLast);
    expect(order.offers).toBeGreaterThan(order.memberships);
  });

  it('writes every compiled row, and a privacy row for the opted-out person only', async () => {
    const { client, calls } = recordingClient();
    await writeBaseline(client, baseline, NO_TABLES, '$2a$12$hash');
    const contains = (table: RegExp, ids: string[]) => expect(flatParams(calls, table)).toEqual(expect.arrayContaining(ids));
    contains(/INSERT INTO auth\.user_tags\b/i, baseline.skills.map(s => s.id));
    contains(/INSERT INTO auth\.skill_endorsements\b/i, baseline.endorsements.map(e => e.id));
    contains(/INSERT INTO inventory\.items\b/i, baseline.items.map(i => i.id));
    contains(/INSERT INTO inventory\.item_shares\b/i, baseline.itemShares.map(s => s.itemId));
    contains(/INSERT INTO requests\.help_offers\b/i, baseline.offers.map(o => o.id));
    const privacyParams = new Set(flatParams(calls, /INSERT INTO auth\.user_privacy_settings\b/i));
    expect(baseline.people.map(p => p.id).filter(pid => privacyParams.has(pid))).toEqual([id(OPT_OUT)]);
  });

  it('sets each derived pair count after the projection, from the weights it read, one UPDATE per non-zero pair', async () => {
    const { client, calls } = recordingClient();
    await writeBaseline(client, baseline, NO_TABLES, '$2a$12$hash');

    const updates = calls.filter(c => isCountUpdate(c.sql));
    expect(first(calls, /INSERT INTO social_graph\.trust_edges\b/i)).toBeGreaterThanOrEqual(0);
    expect(calls.findIndex(c => isCountUpdate(c.sql))).toBeGreaterThan(last(calls, /INSERT INTO social_graph\.trust_edges\b/i));
    expect(calls.findIndex(c => isWeightsRead(c.sql))).toBeGreaterThan(last(calls, /INSERT INTO social_graph\.interaction_weights\b/i));

    const wanted = baseline.endorsementCounts.filter(c => c.count > 0);
    expect(wanted).toHaveLength(4);
    expect(updates).toHaveLength(wanted.length);
    const matched = updates.map(u => {
      // Count and weight in ONE statement, the weight computed from the row's stored columns.
      expect(u.sql).toMatch(/raw_weight\s*=/i);
      expect(u.sql).toMatch(/match_completed_count/i);
      const hit = wanted.filter(w => [w.userIdA, w.userIdB, w.communityId].every(v => u.params.includes(v)));
      expect(hit).toHaveLength(1);
      expect(u.params).toContain(hit[0].count);
      // Numeric equality: a weight may be bound as a number or a numeric string.
      expect(u.params.map(Number)).toEqual(expect.arrayContaining([10.5, 5.5, 3.5, 2.5]));
      return `${hit[0].userIdA}|${hit[0].userIdB}|${hit[0].communityId}`;
    });
    expect(matched.sort()).toEqual(wanted.map(w => `${w.userIdA}|${w.userIdB}|${w.communityId}`).sort());
  });

  it.each([0, 2])('throws when the count UPDATE touches %i rows (every vouch sits on an exchange edge)', async rowCount => {
    await expect(applyEndorsementCounts(recordingClient(rowCount).client, baseline)).rejects.toThrow(/endorsement/i);
    await expect(writeBaseline(recordingClient(rowCount).client, baseline, NO_TABLES, '$2a$12$hash')).rejects.toThrow(/endorsement/i);
    await expect(applyEndorsementCounts(recordingClient(1).client, baseline)).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// expectedSkillDirectory (Critical Note 9)
// ---------------------------------------------------------------------------

describe('Sprint 133 PR D: expectedSkillDirectory', () => {
  const baseline = compile();
  const xKeys = sharedSkillKeys(baseline, OPT_OUT, AMINA);
  const providersActive = new Set(
    baseline.memberships.filter(m => m.communityId === id(PROVIDERS) && m.status === 'active').map(m => m.userId),
  );
  const rawHolders = (key: string) =>
    new Set(baseline.skills.filter(s => directoryKey(s) === key && providersActive.has(s.userId)).map(s => s.userId));

  it('as Noah in Providers, counts X one fewer than its raw holders: ambient-09 is hidden', () => {
    expect(xKeys.length).toBeGreaterThanOrEqual(1);
    const directory = expectedSkillDirectory(baseline, PROVIDERS, NOAH);
    for (const x of xKeys) {
      const holders = rawHolders(x);
      expect(holders.has(id(OPT_OUT))).toBe(true);
      expect(holders.has(id(AMINA))).toBe(true);
      expect(directory[x]).toBe(holders.size - 1);
    }
  });

  it('raises exactly ambient-09\'s skill counts by 1 when ambient-09 shares again, and nothing else', () => {
    const before = expectedSkillDirectory(baseline, PROVIDERS, NOAH);
    const sharing: DemoFixtureManifest = {
      ...CURATED_DEMO_MANIFEST,
      people: CURATED_DEMO_MANIFEST.people.map(p => {
        if (p.key !== OPT_OUT) return p;
        const { shareSkills: _dropped, ...rest } = p;
        return rest;
      }),
    };
    const after = expectedSkillDirectory(compile(sharing), PROVIDERS, NOAH);
    const optOutKeys = new Set(baseline.skills.filter(s => s.userId === id(OPT_OUT)).map(directoryKey));
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const k of keys) {
      expect({ k, n: after[k] ?? 0 }).toEqual({ k, n: (before[k] ?? 0) + (optOutKeys.has(k) ? 1 : 0) });
    }
    for (const x of xKeys) expect(after[x]).toBe(before[x] + 1);
  });

  it('always counts the viewer\'s own skills (skillVisibleToSql\'s owner clause), even when opted out', () => {
    const asOptOut = expectedSkillDirectory(baseline, PROVIDERS, OPT_OUT);
    for (const x of xKeys) expect(asOptOut[x]).toBe(rawHolders(x).size);
  });
});

// ---------------------------------------------------------------------------
// Verifier: skillsVisible and offerBoundary (Critical Note 9)
// ---------------------------------------------------------------------------

const ORD_REQ = '11111111-1111-5111-8111-111111111111';
const MATCH = '22222222-2222-5222-8222-222222222222';
const PROV_REQ = '33333333-3333-5333-8333-333333333333';
const PROV_OFFER = '44444444-4444-5444-8444-444444444444';

interface LiveWorld {
  memberSkills: Record<string, ApiRead<MemberSkillView[]>>; // `${viewer}:${userId}`
  directories: Record<string, ApiRead<SkillDirectoryEntry[]>>; // `${viewer}:${communityId}`
  search: (viewer: DemoViewer, communityId: string, skill: string) => ApiRead<SkillSearchRow[]>;
  offerLists: Record<string, ApiRead<OfferView[]>>; // viewer
  offers: Record<string, ApiRead<OfferView>>; // `${viewer}:${offerId}`
}

const UNREAD = { status: 0, data: null };

function liveWorld(): LiveWorld {
  const baseline = compile();
  const xKeys = new Set(sharedSkillKeys(baseline, OPT_OUT, AMINA));
  const providersDirectory = Object.entries(expectedSkillDirectory(baseline, PROVIDERS, NOAH))
    .map(([skill_key, member_count]) => ({ skill_key, label: skill_key, member_count }));
  return {
    memberSkills: {
      [`maria:${id(SOPHIA)}`]: { status: 200, data: [{ tag_id: 't-sophia', label: 'Tutoring', skill_slug: 'tutoring', endorsement_count: 1 }] },
      [`maria:${id(MARIA)}`]: {
        status: 200,
        data: [
          { tag_id: 't-cook', label: 'Cooking', skill_slug: 'cooking', endorsement_count: 2 },
          { tag_id: 't-drive', label: 'Driving', skill_slug: 'driving', endorsement_count: 0 },
        ],
      },
      [`provider:${id(OPT_OUT)}`]: { status: 404, data: null },
    },
    directories: {
      [`maria:${id(PMA)}`]: { status: 200, data: [{ skill_key: 'cooking', label: 'Cooking', member_count: 2 }] },
      [`provider:${id(PROVIDERS)}`]: { status: 200, data: providersDirectory },
    },
    // Only a search for a skill BOTH ambient-09 and Amina hold returns the control; any other is empty.
    search: (viewer, communityId, skill) =>
      viewer === 'provider' && communityId === id(PROVIDERS) && xKeys.has(normalizeSearchText(skill))
        ? { status: 200, data: [{ user_id: id(AMINA), name: 'Amina Baptiste' }] }
        : { status: 200, data: [] },
    offerLists: {
      maria: { status: 200, data: [{ id: id('offer.sophia-meal-prep') }, { id: id('offer.priya-tutoring') }] },
    },
    offers: {
      [`maria:${id('offer.rides-airport')}`]: { status: 404, data: null },
      [`maria:${id('offer.sophia-meal-prep')}`]: { status: 200, data: { id: id('offer.sophia-meal-prep') } },
      [`unrelated:${id('offer.rides-airport')}`]: { status: 200, data: { id: id('offer.rides-airport') } },
    },
  };
}

function depsFor(world: LiveWorld, searches: string[] = []): DemoVerificationDeps {
  return {
    getMariaMemberships: async () => [{ communityId: 'community-a', role: 'member' }],
    getOrdinaryFloor: async () => ({ pathDegree: 2, sharedConnections: 3, mariaOneHop: 4, helperOneHop: 4 }),
    getReciprocalTopology: async () => true,
    getUnrelatedContextStatus: async () => 404,
    getRunwayDays: async () => 59,
    getOrdinaryContext: async () => ({ bond_depth: 2 }),
    getProviderContext: async () => ({ bond_depth: 1, provider_rating: 4.5 }),
    getProviderStoryValid: async () => true,
    getStoryIds: async () => ({ ordinaryRequestId: ORD_REQ, ordinaryMatchId: MATCH, providerRequestId: PROV_REQ, providerOfferId: PROV_OFFER }),
    getMemberSkills: async (viewer, userId) => world.memberSkills[`${viewer}:${userId}`] ?? UNREAD,
    getSkillDirectory: async (viewer, communityId) => world.directories[`${viewer}:${communityId}`] ?? UNREAD,
    searchCommunitySkills: async (viewer, communityId, skill) => {
      searches.push(skill);
      return world.search(viewer, communityId, skill);
    },
    listOffers: async viewer => world.offerLists[viewer] ?? UNREAD,
    getOffer: async (viewer, offerId) => world.offers[`${viewer}:${offerId}`] ?? UNREAD,
  };
}

describe('Sprint 133 PR D: verifier skillsVisible and offerBoundary', () => {
  it('is ready when every skills and offer read holds, searching Providers for a skill ambient-09 and Amina share', async () => {
    const searches: string[] = [];
    const report = await verifyCuratedDemo(depsFor(liveWorld(), searches));
    expect(report.failedReads).toEqual([]);
    expect(report.checks.skillsVisible).toBe(true);
    expect(report.checks.offerBoundary).toBe(true);
    expect(report.ready).toBe(true);
    const xKeys = new Set(sharedSkillKeys(compile(), OPT_OUT, AMINA));
    expect(searches.length).toBeGreaterThanOrEqual(1);
    for (const skill of searches) expect(xKeys.has(normalizeSearchText(skill))).toBe(true);
  });

  type Perturb = (w: LiveWorld) => void;
  const providersDirectoryOffByOne: Perturb = w => {
    const xKey = sharedSkillKeys(compile(), OPT_OUT, AMINA)[0];
    const read = w.directories[`provider:${id(PROVIDERS)}`];
    read.data = read.data!.map(e => (e.skill_key === xKey ? { ...e, member_count: e.member_count + 1 } : e));
  };

  it.each<[string, Perturb, string]>([
    ['Sophia\'s skills unreadable to Maria', w => { w.memberSkills[`maria:${id(SOPHIA)}`] = { status: 404, data: null }; }, 'skills.member-profile'],
    ['Sophia\'s skills carry no vouch', w => { w.memberSkills[`maria:${id(SOPHIA)}`].data![0].endorsement_count = 0; }, 'skills.member-profile'],
    ['Maria\'s cooking shows 1 vouch, not 2', w => { w.memberSkills[`maria:${id(MARIA)}`].data![0].endorsement_count = 1; }, 'skills.own-cooking-vouches'],
    ['the Portland Mutual Aid directory is empty', w => { w.directories[`maria:${id(PMA)}`] = { status: 200, data: [] }; }, 'skills.community-directory'],
    ['ambient-09\'s skills are readable to Noah', w => { w.memberSkills[`provider:${id(OPT_OUT)}`] = { status: 200, data: [] }; }, 'skills.opt-out-profile-hidden'],
    ['ambient-09\'s id is present in the X search', w => {
      const inner = w.search;
      w.search = (v, c, s) => {
        const r = inner(v, c, s);
        return { status: r.status, data: [...(r.data ?? []), { user_id: id(OPT_OUT), name: 'Nora Thompson' }] };
      };
    }, 'skills.opt-out-search-absent'],
    ['Amina\'s id is missing: an empty X search', w => { w.search = () => ({ status: 200, data: [] }); }, 'skills.opt-out-search-control'],
    ['the Providers directory differs from expectedSkillDirectory by one count', providersDirectoryOffByOne, 'skills.directory-exact'],
  ])('fails skillsVisible when %s', async (_name, perturb, failedRead) => {
    const world = liveWorld();
    perturb(world);
    const report = await verifyCuratedDemo(depsFor(world));
    expect(report.failedReads).toEqual([failedRead]);
    expect(report.checks.skillsVisible).toBe(false);
    expect(report.checks.offerBoundary).toBe(true);
    expect(report.ready).toBe(false);
    expect(report.storyIds).toBeUndefined();
  });

  it.each<[string, Perturb, string]>([
    ['Maria\'s list misses a Portland Mutual Aid offer', w => { w.offerLists.maria.data = [{ id: id('offer.sophia-meal-prep') }]; }, 'offers.member-list'],
    ['Maria\'s list contains the rides offer', w => { w.offerLists.maria.data!.push({ id: id('offer.rides-airport') }); }, 'offers.foreign-list-absent'],
    ['the foreign offer answers 403 (only 404 passes)', w => { w.offers[`maria:${id('offer.rides-airport')}`] = { status: 403, data: null }; }, 'offers.foreign-read-404'],
    ['the foreign offer read is a transport error', w => { w.offers[`maria:${id('offer.rides-airport')}`] = { status: 0, data: null }; }, 'offers.foreign-read-404'],
    ['the foreign offer is readable to Maria', w => { w.offers[`maria:${id('offer.rides-airport')}`] = { status: 200, data: { id: id('offer.rides-airport') } }; }, 'offers.foreign-read-404'],
    ['Maria cannot read Sophia\'s offer', w => { w.offers[`maria:${id('offer.sophia-meal-prep')}`] = { status: 404, data: null }; }, 'offers.member-read'],
    ['the unrelated persona gets 404 for the rides offer (a vacuous boundary)', w => { w.offers[`unrelated:${id('offer.rides-airport')}`] = { status: 404, data: null }; }, 'offers.non-vacuous-read'],
  ])('fails offerBoundary when %s', async (_name, perturb, failedRead) => {
    const world = liveWorld();
    perturb(world);
    const report = await verifyCuratedDemo(depsFor(world));
    expect(report.failedReads).toEqual([failedRead]);
    expect(report.checks.offerBoundary).toBe(false);
    expect(report.checks.skillsVisible).toBe(true);
    expect(report.ready).toBe(false);
    expect(report.storyIds).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// api-client reads used by the offerBoundary dependency
// ---------------------------------------------------------------------------

describe('Sprint 133 PR D: ApiClient offer reads', () => {
  function fakeHttp(get: jest.Mock) {
    return { defaults: { headers: { common: {} as Record<string, string> } }, get, post: jest.fn() };
  }

  it('listOffers reads GET /offers and returns the offers array', async () => {
    const get = jest.fn().mockResolvedValue({ data: { success: true, data: { offers: [{ id: 'o-1' }, { id: 'o-2' }], count: 2, total: 2 } } });
    mockedAxios.create.mockReturnValue(fakeHttp(get) as never);
    const offers = await new ApiClient('http://localhost/api').listOffers();
    expect(get).toHaveBeenCalledTimes(1);
    expect(get.mock.calls[0][0]).toBe('/offers');
    expect(offers).toEqual([{ id: 'o-1' }, { id: 'o-2' }]);
  });

  it('getOffer reads GET /offers/:id, returns the offer, and surfaces the HTTP status on failure', async () => {
    const get = jest.fn()
      .mockResolvedValueOnce({ data: { success: true, data: { id: 'o-1', title: 'Meal prep' } } })
      .mockRejectedValueOnce(Object.assign(new Error('Not found'), { response: { status: 404 } }));
    mockedAxios.create.mockReturnValue(fakeHttp(get) as never);
    const api = new ApiClient('http://localhost/api');
    await expect(api.getOffer('o-1')).resolves.toEqual({ id: 'o-1', title: 'Meal prep' });
    expect(get.mock.calls[0][0]).toBe('/offers/o-1');
    await expect(api.getOffer('o-missing')).rejects.toMatchObject({ response: { status: 404 } });
    expect(get.mock.calls[1][0]).toBe('/offers/o-missing');
  });
});
