/**
 * Sprint 117 — Curated Demo Fixtures: the authoritative manifest.
 *
 * A compact 36-person, six-community historical baseline. Density, age, and texture knobs
 * live in `tuning`; the hard privacy/lifecycle/cohort/simulator/story floors in
 * `STORY_HARD_FLOOR` cannot be tuned away (the compiler enforces them). No `trustEdges` or
 * `trustScores` are declared here — trust topology and karma are derived from completed
 * exchanges by the fixture-only projection.
 */

import type {
  ActivityFixture,
  DemoFixtureManifest,
  FixtureCommunity,
  FixtureExpectation,
  FixtureMembership,
  FixturePerson,
  GovernanceFixture,
  HistoricalExchangeFixture,
  EndorsementFixture,
  HistoricalRequestFixture,
  ItemFixture,
  OfferFixture,
  ProviderFixture,
  SkillFixture,
  SemanticKey,
} from './types';

/** Immutable story floors. The compiler refuses any manifest that tries to weaken these. */
export const STORY_HARD_FLOOR = Object.freeze({
  maxPathDegree: 2,
  minSharedPeople: 3,
  minOneHopPerSide: 4,
});

/** Minimum active members any community aggregate surface may display (ADR-082). */
export const MIN_ACTIVE_MEMBERS_PER_COMMUNITY = 5;

export const CURATED_PEOPLE: FixturePerson[] = [
  { key: 'person.maria', name: 'Maria Reyes', email: 'maria.reyes@test.karmyq.com', classification: 'protected' },
  { key: 'person.helper', name: 'Elena Torres', email: 'elena.torres@test.karmyq.com', classification: 'protected' },
  { key: 'person.provider', name: 'Noah Williams', email: 'noah.williams@test.karmyq.com', classification: 'protected' },
  { key: 'person.shared-sophia', name: 'Sophia Chen', email: 'sophia.chen@test.karmyq.com', classification: 'protected' },
  { key: 'person.shared-james', name: 'James Okafor', email: 'james.okafor@test.karmyq.com', classification: 'protected' },
  { key: 'person.shared-priya', name: 'Priya Sharma', email: 'priya.sharma@test.karmyq.com', classification: 'protected' },
  { key: 'person.maria-exclusive', name: 'Wei Zhang', email: 'wei.zhang@test.karmyq.com', classification: 'protected' },
  { key: 'person.helper-exclusive', name: 'Fatima Alhassan', email: 'fatima.alhassan@test.karmyq.com', classification: 'protected' },
  { key: 'person.bridge', name: 'Amina Baptiste', email: 'amina.baptiste@test.karmyq.com', classification: 'protected' },
  { key: 'person.steward-mutual-aid', name: 'David Rodriguez', email: 'david.rodriguez@test.karmyq.com', classification: 'ambient' },
  { key: 'person.steward-southeast', name: 'Nadia Ito', email: 'nadia.ito@test.karmyq.com', classification: 'ambient' },
  { key: 'person.steward-tools', name: 'Samuel Green', email: 'samuel.green@test.karmyq.com', classification: 'ambient' },
  { key: 'person.steward-providers', name: 'Grace Kim', email: 'grace.kim@test.karmyq.com', classification: 'ambient' },
  { key: 'person.steward-rides', name: 'Omar Hassan', email: 'omar.hassan@test.karmyq.com', classification: 'ambient' },
  { key: 'person.steward-group', name: 'Lucy Martinez', email: 'lucy.martinez@test.karmyq.com', classification: 'ambient' },
  { key: 'person.isolate', name: 'Evelyn Brooks', email: 'evelyn.brooks@test.karmyq.com', classification: 'ambient' },
  { key: 'person.outsider', name: 'Marcus Lee', email: 'marcus.lee@test.karmyq.com', classification: 'ambient' },
  { key: 'person.ambient-01', name: 'Lena Patel', email: 'lena.patel@test.karmyq.com', classification: 'ambient' },
  { key: 'person.ambient-02', name: 'Theo Johnson', email: 'theo.johnson@test.karmyq.com', classification: 'ambient' },
  { key: 'person.ambient-03', name: 'Maya Wilson', email: 'maya.wilson@test.karmyq.com', classification: 'ambient' },
  { key: 'person.ambient-04', name: 'Ibrahim Diallo', email: 'ibrahim.diallo@test.karmyq.com', classification: 'ambient' },
  { key: 'person.ambient-05', name: 'Hana Suzuki', email: 'hana.suzuki@test.karmyq.com', classification: 'ambient' },
  { key: 'person.ambient-06', name: 'Mateo Garcia', email: 'mateo.garcia@test.karmyq.com', classification: 'ambient' },
  { key: 'person.ambient-07', name: 'Zara Ahmed', email: 'zara.ahmed@test.karmyq.com', classification: 'ambient' },
  { key: 'person.ambient-08', name: 'Caleb Brown', email: 'caleb.brown@test.karmyq.com', classification: 'ambient' },
  { key: 'person.ambient-09', name: 'Nora Thompson', email: 'nora.thompson@test.karmyq.com', classification: 'ambient', shareSkills: false },
  { key: 'person.ambient-10', name: 'Diego Morales', email: 'diego.morales@test.karmyq.com', classification: 'ambient' },
  { key: 'person.ambient-11', name: 'Leila Haddad', email: 'leila.haddad@test.karmyq.com', classification: 'ambient' },
  { key: 'person.ambient-12', name: 'Jonas Miller', email: 'jonas.miller@test.karmyq.com', classification: 'ambient' },
  { key: 'person.ambient-13', name: 'Sofia Rivera', email: 'sofia.rivera@test.karmyq.com', classification: 'ambient' },
  { key: 'person.ambient-14', name: 'Kwame Mensah', email: 'kwame.mensah@test.karmyq.com', classification: 'ambient' },
  { key: 'person.ambient-15', name: 'Anika Singh', email: 'anika.singh@test.karmyq.com', classification: 'ambient' },
  { key: 'person.ambient-16', name: 'Ben Carter', email: 'ben.carter@test.karmyq.com', classification: 'ambient' },
  { key: 'person.ambient-17', name: 'Rosa Flores', email: 'rosa.flores@test.karmyq.com', classification: 'ambient' },
  { key: 'person.ambient-18', name: 'Malik Robinson', email: 'malik.robinson@test.karmyq.com', classification: 'ambient' },
  { key: 'person.ambient-19', name: 'Chloe Nguyen', email: 'chloe.nguyen@test.karmyq.com', classification: 'ambient' },
];

export const CURATED_COMMUNITIES: FixtureCommunity[] = [
  { key: 'community.portland-mutual-aid', name: 'Portland Mutual Aid Network', type: 'mutual_aid' },
  { key: 'community.southeast-pdx', name: 'Southeast PDX Helpers', type: 'neighborhood' },
  { key: 'community.tool-library', name: 'Portland Tool Library & Share', type: 'sharing' },
  { key: 'community.providers', name: 'PDX Service Providers Network', type: 'professional' },
  { key: 'community.rides', name: 'PDX Rides Collective', type: 'professional' },
  { key: 'community.weekend-group', name: 'Portland Weekend Helpers', type: 'group' },
];

// ---------------------------------------------------------------------------
// Community rosters → memberships. Each community has a distinct steward (admin) and at
// least MIN_ACTIVE_MEMBERS_PER_COMMUNITY active members. Maria is a plain member everywhere.
// ---------------------------------------------------------------------------

interface Roster {
  community: SemanticKey;
  steward: SemanticKey;
  members: SemanticKey[];
  joinedAge: string;
}

const ROSTERS: Roster[] = [
  {
    community: 'community.portland-mutual-aid',
    steward: 'person.steward-mutual-aid',
    joinedAge: 'P300D',
    members: [
      'person.maria', 'person.helper', 'person.shared-sophia', 'person.shared-james',
      'person.shared-priya', 'person.maria-exclusive', 'person.bridge',
      'person.ambient-01', 'person.ambient-02',
    ],
  },
  {
    community: 'community.southeast-pdx',
    steward: 'person.steward-southeast',
    joinedAge: 'P260D',
    members: [
      'person.maria', 'person.helper', 'person.shared-sophia', 'person.helper-exclusive',
      'person.ambient-03', 'person.ambient-04', 'person.ambient-05',
    ],
  },
  {
    community: 'community.tool-library',
    steward: 'person.steward-tools',
    joinedAge: 'P220D',
    members: [
      'person.shared-james', 'person.shared-priya', 'person.isolate',
      'person.ambient-06', 'person.ambient-07', 'person.ambient-08',
    ],
  },
  {
    community: 'community.providers',
    steward: 'person.steward-providers',
    joinedAge: 'P200D',
    members: [
      'person.provider', 'person.bridge',
      'person.ambient-09', 'person.ambient-10', 'person.ambient-11', 'person.ambient-12',
    ],
  },
  {
    community: 'community.rides',
    steward: 'person.steward-rides',
    joinedAge: 'P180D',
    members: [
      'person.outsider',
      'person.ambient-13', 'person.ambient-14', 'person.ambient-15', 'person.ambient-16',
    ],
  },
  {
    community: 'community.weekend-group',
    steward: 'person.steward-group',
    joinedAge: 'P160D',
    members: [
      'person.ambient-17', 'person.ambient-18', 'person.ambient-19',
      'person.ambient-01', 'person.ambient-02',
    ],
  },
];

function buildMemberships(): FixtureMembership[] {
  const rows: FixtureMembership[] = [];
  for (const roster of ROSTERS) {
    rows.push({
      user: roster.steward,
      community: roster.community,
      role: 'admin',
      status: 'active',
      joinedAge: roster.joinedAge as FixtureMembership['joinedAge'],
    });
    for (const member of roster.members) {
      rows.push({
        user: member,
        community: roster.community,
        role: 'member',
        status: 'active',
        joinedAge: roster.joinedAge as FixtureMembership['joinedAge'],
      });
    }
  }
  // One pending membership for onboarding-request texture (does not count toward active cohort).
  rows.push({
    user: 'person.ambient-19',
    community: 'community.portland-mutual-aid',
    role: 'member',
    status: 'pending',
    joinedAge: 'P2D',
  });
  return rows;
}

// ---------------------------------------------------------------------------
// Completed exchanges. These build the trust topology through truthful repeated helping,
// not invented edges. Maria's one-hop partners: Sophia, James, Priya, Wei, Amina (5 ≥ 4).
// Elena's one-hop partners: Sophia, James, Priya, Fatima (4 ≥ 4). Shared between Maria and
// Elena: Sophia, James, Priya (3 ≥ 3). Maria↔Elena path degree via any shared neighbor = 2.
// ---------------------------------------------------------------------------

function ex(
  key: string,
  requester: SemanticKey,
  helper: SemanticKey,
  community: SemanticKey,
  completedAge: string,
  category = 'errand',
): HistoricalExchangeFixture {
  return { key: key as SemanticKey, requester, helper, community, completedAge: completedAge as HistoricalExchangeFixture['completedAge'], category };
}

const CURATED_EXCHANGES: HistoricalExchangeFixture[] = [
  // Maria ↔ Sophia (4) — the strongest bond, aged across the full window.
  ex('exchange.maria-sophia-1', 'person.maria', 'person.shared-sophia', 'community.portland-mutual-aid', 'P179D'),
  ex('exchange.maria-sophia-2', 'person.shared-sophia', 'person.maria', 'community.portland-mutual-aid', 'P120D'),
  ex('exchange.maria-sophia-3', 'person.maria', 'person.shared-sophia', 'community.portland-mutual-aid', 'P45D'),
  ex('exchange.maria-sophia-4', 'person.shared-sophia', 'person.maria', 'community.portland-mutual-aid', 'P12D'),
  // Elena ↔ Sophia (2).
  ex('exchange.helper-sophia-1', 'person.helper', 'person.shared-sophia', 'community.southeast-pdx', 'P120D'),
  ex('exchange.helper-sophia-2', 'person.shared-sophia', 'person.helper', 'community.southeast-pdx', 'P12D'),
  // Maria ↔ James (2).
  ex('exchange.maria-james-1', 'person.maria', 'person.shared-james', 'community.portland-mutual-aid', 'P179D'),
  ex('exchange.maria-james-2', 'person.shared-james', 'person.maria', 'community.portland-mutual-aid', 'P45D'),
  // Elena ↔ James (2).
  ex('exchange.helper-james-1', 'person.helper', 'person.shared-james', 'community.portland-mutual-aid', 'P120D'),
  ex('exchange.helper-james-2', 'person.shared-james', 'person.helper', 'community.portland-mutual-aid', 'P45D'),
  // Maria ↔ Priya (1) and Elena ↔ Priya (1) — the third shared neighbor.
  ex('exchange.maria-priya-1', 'person.maria', 'person.shared-priya', 'community.portland-mutual-aid', 'P120D'),
  ex('exchange.helper-priya-1', 'person.shared-priya', 'person.helper', 'community.portland-mutual-aid', 'P120D'),
  // Maria ↔ Wei (2) — Maria-exclusive one-hop.
  ex('exchange.maria-wei-1', 'person.maria', 'person.maria-exclusive', 'community.portland-mutual-aid', 'P179D'),
  ex('exchange.maria-wei-2', 'person.maria-exclusive', 'person.maria', 'community.portland-mutual-aid', 'P12D'),
  // Elena ↔ Fatima (2) — helper-exclusive one-hop.
  ex('exchange.helper-fatima-1', 'person.helper', 'person.helper-exclusive', 'community.southeast-pdx', 'P45D'),
  ex('exchange.helper-fatima-2', 'person.helper-exclusive', 'person.helper', 'community.southeast-pdx', 'P12D'),
  // Bridge: Maria ↔ Amina ↔ provider — the low-overlap path to the provider.
  ex('exchange.maria-amina-1', 'person.maria', 'person.bridge', 'community.portland-mutual-aid', 'P45D'),
  ex('exchange.amina-provider-1', 'person.bridge', 'person.provider', 'community.providers', 'P45D', 'service'),
  // Ambient texture: a redundant triangle and a recent pulse, none touching the story floor.
  ex('exchange.ambient-triangle-1', 'person.ambient-01', 'person.ambient-02', 'community.portland-mutual-aid', 'P30D'),
  ex('exchange.ambient-triangle-2', 'person.ambient-02', 'person.ambient-03', 'community.southeast-pdx', 'P14D'),
  ex('exchange.ambient-pulse-1', 'person.ambient-04', 'person.ambient-05', 'community.southeast-pdx', 'P3D'),
  ex('exchange.ambient-tools-1', 'person.ambient-06', 'person.ambient-07', 'community.tool-library', 'P7D'),
];

// ---------------------------------------------------------------------------
// Historical lifecycle-texture requests (non-exchange). Fresh/open, scoped visibility,
// matched-in-flight, expired, and designed-to-forget lanes for feed/retention surfaces.
// requests[0] is fresh so its createdAt shifts cleanly with the reset anchor.
// ---------------------------------------------------------------------------

const CURATED_REQUESTS: HistoricalRequestFixture[] = [
  {
    key: 'request.fresh-open', requester: 'person.maria', communities: ['community.portland-mutual-aid'],
    title: 'Help carrying groceries up three flights', description: 'Recovering from surgery, need a hand this week.',
    category: 'errand', status: 'open', visibility: 'community', createdAge: 'P3D',
  },
  {
    key: 'request.trust-scope', requester: 'person.ambient-01', communities: ['community.portland-mutual-aid'],
    title: 'Borrow a folding table for the weekend', description: 'Hosting a small block gathering.',
    category: 'lending', status: 'open', visibility: 'trust_network', createdAge: 'P5D',
  },
  {
    key: 'request.platform-scope', requester: 'person.ambient-03', communities: ['community.southeast-pdx'],
    title: 'Anyone driving toward the coast Saturday?', description: 'Willing to share gas.',
    category: 'ride', requestType: 'ride', status: 'open', visibility: 'platform', createdAge: 'P6D',
  },
  {
    key: 'request.matched-inflight', requester: 'person.ambient-07', communities: ['community.tool-library'],
    title: 'Need a drill for a shelf install', description: 'Just for an afternoon.',
    category: 'lending', status: 'matched', visibility: 'community', createdAge: 'P14D',
    helper: 'person.ambient-08', matchStatus: 'accepted',
  },
  {
    key: 'request.declined', requester: 'person.ambient-05', communities: ['community.southeast-pdx'],
    title: 'Move a couch on Sunday', description: 'Second floor, no elevator.',
    category: 'moving', status: 'declined', visibility: 'community', createdAge: 'P20D',
    helper: 'person.ambient-04', matchStatus: 'declined',
  },
  {
    key: 'request.expired', requester: 'person.ambient-05', communities: ['community.southeast-pdx'],
    title: 'Rides to the Tuesday market', description: 'Timing has passed.',
    category: 'ride', requestType: 'ride', status: 'expired', visibility: 'community',
    createdAge: 'P70D', expiresAge: 'P10D',
  },
  {
    key: 'request.forgotten', requester: 'person.ambient-06', communities: ['community.tool-library'],
    title: '[forgotten]', description: '[forgotten]',
    category: 'errand', status: 'forgotten', visibility: 'community',
    createdAge: 'P200D', expiresAge: 'P140D', forgotten: true,
  },
];

const CURATED_PROVIDERS: ProviderFixture[] = [
  {
    key: 'provider.noah', user: 'person.provider', community: 'community.providers',
    serviceType: 'handyman', description: 'Licensed handyman offering small home repairs.',
  },
];

const CURATED_GOVERNANCE: GovernanceFixture[] = [
  {
    key: 'governance.pma-quiet-hours', community: 'community.portland-mutual-aid',
    proposer: 'person.steward-mutual-aid', title: 'Adopt quiet-hours norm for ride requests',
    description: 'No ride pings between 10pm and 6am.', status: 'open', createdAge: 'P8D',
  },
];

const CURATED_ACTIVITIES: ActivityFixture[] = [
  {
    key: 'activity.pma-tool-share', community: 'community.portland-mutual-aid',
    organizer: 'person.steward-mutual-aid', title: 'Saturday tool-share meetup',
    description: 'Bring a tool, borrow a tool.', scheduledAge: 'PT48H', createdAge: 'P10D',
  },
];

// ---------------------------------------------------------------------------
// Skills layer (Sprint 133 PR D). Skills are `auth.user_tags` rows; a slugged skill stores
// the vocabulary LABEL as its value, a free-text tag has no slug. Endorsements sit on a
// seeded exchange between the pair; trust-edge counts are DERIVED from them, never authored.
// ---------------------------------------------------------------------------

/** Short name used in skill keys -> the person's semantic key. */
const SKILL_OWNER: Record<string, SemanticKey> = {
  maria: 'person.maria',
  elena: 'person.helper',
  noah: 'person.provider',
  sophia: 'person.shared-sophia',
  james: 'person.shared-james',
  priya: 'person.shared-priya',
  wei: 'person.maria-exclusive',
  fatima: 'person.helper-exclusive',
  amina: 'person.bridge',
};

function sk(who: string, label: string, slug?: string): SkillFixture {
  const slugPart = slug ?? label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return {
    key: `skill.${who}.${slugPart}`,
    owner: SKILL_OWNER[who] ?? `person.${who}`,
    value: label,
    ...(slug ? { slug } : {}),
  };
}

const CURATED_SKILLS: SkillFixture[] = [
  // Story core: everyone who helped in a seeded exchange holds 2-4 skills.
  sk('maria', 'Cooking', 'cooking'),
  sk('maria', 'Driving', 'driving'),
  sk('maria', 'Gardening', 'gardening'),
  sk('elena', 'Tech support', 'tech_support'),
  sk('elena', 'Tutoring', 'tutoring'),
  sk('elena', 'Grant writing'),
  sk('noah', 'Handyman', 'handyman'),
  sk('noah', 'Plumbing', 'plumbing'),
  sk('noah', 'Electrical', 'electrical'),
  sk('noah', 'Home repair', 'home_repair'),
  sk('sophia', 'Tutoring', 'tutoring'),
  sk('sophia', 'Cooking', 'cooking'),
  sk('sophia', 'Baking', 'baking'),
  sk('james', 'Home repair', 'home_repair'),
  sk('james', 'Carpentry', 'carpentry'),
  sk('james', 'Driving', 'driving'),
  sk('priya', 'Tutoring', 'tutoring'),
  sk('priya', 'Coding', 'coding'),
  sk('priya', 'Resume review'),
  sk('wei', 'Cooking', 'cooking'),
  sk('wei', 'Tech support', 'tech_support'),
  sk('fatima', 'Childcare', 'childcare'),
  sk('fatima', 'Languages', 'languages'),
  sk('fatima', 'Arabic translation'),
  // Amina holds skill X (bookkeeping) together with the opted-out ambient-09: the positive
  // control for the opt-out proof (a search as Noah finds Amina, never ambient-09).
  sk('amina', 'Bookkeeping', 'bookkeeping'),
  sk('amina', 'Organizing', 'organizing'),
  sk('amina', 'Writing', 'writing'),
  // Ambient helpers.
  sk('ambient-02', 'Music', 'music'),
  sk('ambient-02', 'Design', 'design'),
  sk('ambient-03', 'Photography', 'photography'),
  sk('ambient-03', 'Art', 'art'),
  sk('ambient-05', 'Cleaning', 'cleaning'),
  sk('ambient-05', 'Pet care', 'pet_care'),
  sk('ambient-07', 'Moving', 'moving'),
  sk('ambient-07', 'Bike repair'),
  // About half of the other ambient people hold 1-2.
  sk('ambient-01', 'Gardening', 'gardening'),
  sk('ambient-04', 'Elder care', 'elder_care'),
  sk('ambient-06', 'Carpentry', 'carpentry'),
  sk('ambient-08', 'Tool sharpening'),
  sk('ambient-10', 'Writing', 'writing'),
  sk('ambient-11', 'Childcare', 'childcare'),
  sk('ambient-13', 'Driving', 'driving'),
  // ambient-09 opts out of sharing skills (see its person fixture) and still holds skills.
  sk('ambient-09', 'Bookkeeping', 'bookkeeping'),
  sk('ambient-09', 'Spreadsheet help'),
];

function vouch(
  key: string,
  endorser: SemanticKey,
  skill: SemanticKey,
  exchange: SemanticKey,
  createdAge: EndorsementFixture['createdAge'],
  withdrawnAge?: EndorsementFixture['createdAge'],
): EndorsementFixture {
  return { key, endorser, skill, exchange, createdAge, ...(withdrawnAge ? { withdrawnAge } : {}) };
}

const CURATED_ENDORSEMENTS: EndorsementFixture[] = [
  vouch('endorsement.sophia-maria-cooking', 'person.shared-sophia', 'skill.maria.cooking', 'exchange.maria-sophia-4', 'P10D'),
  vouch('endorsement.maria-sophia-tutoring', 'person.maria', 'skill.sophia.tutoring', 'exchange.maria-sophia-3', 'P40D'),
  vouch('endorsement.wei-maria-cooking', 'person.maria-exclusive', 'skill.maria.cooking', 'exchange.maria-wei-2', 'P9D'),
  // Withdrawn: the edge stays (it comes from exchanges) and its endorsement count stays 0.
  vouch('endorsement.james-maria-driving', 'person.shared-james', 'skill.maria.driving', 'exchange.maria-james-2', 'P40D', 'P20D'),
  vouch('endorsement.helper-fatima', 'person.helper', 'skill.fatima.childcare', 'exchange.helper-fatima-1', 'P44D'),
  vouch('endorsement.fatima-helper', 'person.helper-exclusive', 'skill.elena.tech_support', 'exchange.helper-fatima-2', 'P11D'),
  vouch('endorsement.amina-noah-handyman', 'person.bridge', 'skill.noah.handyman', 'exchange.amina-provider-1', 'P43D'),
];

// ---------------------------------------------------------------------------
// Items: personal items shared only to communities the owner actively belongs to, plus
// four Tool Library items owned by the community (created by its admin, never shared).
// No borrow requests are seeded.
// ---------------------------------------------------------------------------

const CURATED_ITEMS: ItemFixture[] = [
  {
    key: 'item.james-extension-ladder', owner: 'person.shared-james', name: 'Extension ladder',
    description: '24-foot fiberglass ladder. Happy to lend for a weekend.', category: 'tools', condition: 'good',
    sharedWith: ['community.tool-library', 'community.portland-mutual-aid'],
  },
  {
    key: 'item.priya-cordless-drill', owner: 'person.shared-priya', name: 'Cordless drill',
    description: 'Drill and driver set with two batteries.', category: 'tools', condition: 'like_new',
    sharedWith: ['community.tool-library', 'community.portland-mutual-aid'],
  },
  {
    key: 'item.sophia-camp-stove', owner: 'person.shared-sophia', name: 'Two-burner camp stove',
    description: 'Propane not included.', category: 'camping', condition: 'good',
    sharedWith: ['community.portland-mutual-aid', 'community.southeast-pdx'],
  },
  {
    key: 'item.maria-stand-mixer', owner: 'person.maria', name: 'Stand mixer',
    description: 'Great for big batches of bread or cookies.', category: 'kitchen', condition: 'like_new',
    sharedWith: ['community.portland-mutual-aid', 'community.southeast-pdx'],
  },
  {
    key: 'item.elena-projector', owner: 'person.helper', name: 'Portable projector',
    description: 'Good for a movie night or a neighborhood meeting.', category: 'electronics', condition: 'good',
    sharedWith: ['community.southeast-pdx'],
  },
  {
    key: 'item.fatima-board-games', owner: 'person.helper-exclusive', name: 'Board game collection',
    description: 'A dozen family-friendly games.', category: 'party', condition: 'fair',
    sharedWith: ['community.southeast-pdx'],
  },
  {
    key: 'item.library-shop-vacuum', owner: 'community.tool-library', name: 'Wet/dry shop vacuum',
    description: 'Community-owned. Return it empty.', category: 'tools', condition: 'good',
    createdBy: 'person.steward-tools',
  },
  {
    key: 'item.library-folding-tables', owner: 'community.tool-library', name: 'Folding tables (set of four)',
    description: 'Community-owned. Fits a block party.', category: 'party', condition: 'good',
    createdBy: 'person.steward-tools',
  },
  {
    key: 'item.library-pressure-washer', owner: 'community.tool-library', name: 'Electric pressure washer',
    description: 'Community-owned.', category: 'tools', condition: 'fair',
    createdBy: 'person.steward-tools',
  },
  {
    key: 'item.library-canopy', owner: 'community.tool-library', name: 'Pop-up canopy',
    description: 'Community-owned. Ten by ten feet.', category: 'camping', condition: 'good',
    createdBy: 'person.steward-tools',
  },
];

// ---------------------------------------------------------------------------
// Standing offers. Two are in Portland Mutual Aid (Maria is a member and can read them); one
// is in PDX Rides Collective (Maria is not a member: she gets 404, and it is absent from her list).
// ---------------------------------------------------------------------------

const CURATED_OFFERS: OfferFixture[] = [
  {
    key: 'offer.sophia-meal-prep', offerer: 'person.shared-sophia', community: 'community.portland-mutual-aid',
    title: 'Batch meal prep for a neighbor',
    description: 'I can cook a few days of meals for someone recovering or short on time.',
    category: 'physical_help', createdAge: 'P5D',
  },
  {
    key: 'offer.priya-tutoring', offerer: 'person.shared-priya', community: 'community.portland-mutual-aid',
    title: 'Free math and coding tutoring',
    description: 'Evenings, for students or adults picking up a new skill.',
    category: 'skills', createdAge: 'P9D',
  },
  {
    key: 'offer.rides-airport', offerer: 'person.ambient-13', community: 'community.rides',
    title: 'Airport rides on weekends',
    description: 'Room for two passengers and luggage. Message me a few days ahead.',
    category: 'transportation', createdAge: 'P7D',
  },
];

const CURATED_EXPECTATIONS: FixtureExpectation[] = [
  { key: 'reciprocal.maria-helper', description: 'Maria and Elena see a reciprocal ≤2-degree path.', kind: 'reciprocal-topology', subjects: ['person.maria', 'person.helper'] },
  { key: 'shared.maria-helper', description: 'Maria and Elena share ≥3 named neighbors.', kind: 'shared-neighbors', subjects: ['person.maria', 'person.helper'], value: STORY_HARD_FLOOR.minSharedPeople },
  { key: 'onehop.maria', description: 'Maria shows ≥4 one-hop neighbors.', kind: 'one-hop-floor', subjects: ['person.maria'], value: STORY_HARD_FLOOR.minOneHopPerSide },
  { key: 'onehop.helper', description: 'Elena shows ≥4 one-hop neighbors.', kind: 'one-hop-floor', subjects: ['person.helper'], value: STORY_HARD_FLOOR.minOneHopPerSide },
  { key: 'provider.contrast', description: 'The provider path is truthfully lower-overlap.', kind: 'provider-contrast', subjects: ['person.maria', 'person.provider'] },
  { key: 'unrelated.denial', description: 'An unrelated member cannot inspect Maria\'s neighborhood.', kind: 'unrelated-denial', subjects: ['person.outsider', 'person.maria'] },
  { key: 'privacy.ordinary', description: 'Ordinary relationship views expose no raw trust metrics.', kind: 'privacy-scope', subjects: ['person.maria', 'person.helper'] },
  { key: 'aggregate.pma', description: 'Portland Mutual Aid shows ≥5 active members.', kind: 'aggregate-cohort', subjects: ['community.portland-mutual-aid'], value: MIN_ACTIVE_MEMBERS_PER_COMMUNITY },
  { key: 'pulse.se-pdx', description: 'Southeast PDX shows a recent weekly pulse.', kind: 'pulse', subjects: ['community.southeast-pdx'] },
  { key: 'retention.tool', description: 'Tool Library shows retention/forgotten transparency.', kind: 'retention', subjects: ['community.tool-library'] },
  { key: 'governance.pma', description: 'Portland Mutual Aid shows an open governance proposal.', kind: 'governance', subjects: ['community.portland-mutual-aid'] },
  { key: 'activity.pma', description: 'Portland Mutual Aid shows an upcoming activity.', kind: 'activity', subjects: ['community.portland-mutual-aid'] },
  { key: 'skills.visible', description: 'Skills and vouches are visible to community members; the opted-out member is hidden from search and counts.', kind: 'skills', subjects: ['person.maria', 'person.shared-sophia', 'person.ambient-09', 'person.bridge', 'person.provider', 'community.portland-mutual-aid', 'community.providers'] },
  { key: 'offers.boundary', description: 'A member reads their communities\' offers; a foreign community\'s offer is a 404 while a member of that community reads it.', kind: 'offer-boundary', subjects: ['person.maria', 'person.outsider', 'person.ambient-13', 'community.rides'] },
];

export const CURATED_DEMO_MANIFEST: DemoFixtureManifest = {
  version: 1,
  tuning: {
    peopleTarget: 36,
    minimumStoryRunwayDays: 14,
    maxPathDegree: STORY_HARD_FLOOR.maxPathDegree,
    minSharedPeople: STORY_HARD_FLOOR.minSharedPeople,
    minOneHopPerSide: STORY_HARD_FLOOR.minOneHopPerSide,
  },
  people: CURATED_PEOPLE,
  communities: CURATED_COMMUNITIES,
  memberships: buildMemberships(),
  requests: CURATED_REQUESTS,
  exchanges: CURATED_EXCHANGES,
  providers: CURATED_PROVIDERS,
  governance: CURATED_GOVERNANCE,
  activities: CURATED_ACTIVITIES,
  skills: CURATED_SKILLS,
  endorsements: CURATED_ENDORSEMENTS,
  items: CURATED_ITEMS,
  offers: CURATED_OFFERS,
  expectedBehaviors: CURATED_EXPECTATIONS,
};

/**
 * Emails of every protected fixture identity — Maria, her helper, the provider, and every
 * story dependency (shared neighbors, exclusives, bridge). The simulator must exclude all of
 * these, not only the configured `DEMO_PERSONA_EMAIL`. Derived from manifest classification,
 * never a hand-maintained second list.
 */
export function getProtectedFixtureEmails(): string[] {
  return CURATED_DEMO_MANIFEST.people
    .filter(p => p.classification === 'protected')
    .map(p => p.email);
}
