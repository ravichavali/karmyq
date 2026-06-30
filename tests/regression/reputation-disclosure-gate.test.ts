/**
 * Sprint 112 — Reputation Disclosure CI Gate (ADR-082).
 *
 * Contract-based regression gate (NOT a naive repository-wide word ban). It asserts that every
 * reputation-bearing outward endpoint is classified, schema-bound, test-owned, and — for the
 * privacy-critical self/ordinary_member classes — that its representative response fixture carries
 * no forbidden reputation key at any nesting depth.
 *
 * Bidirectional drift protection:
 *   - every registry `reputation_disclosure` classification has a matching inventory entry;
 *   - every inventory entry has a matching registry classification;
 *   - every sensitive READ root that appears in any service's `apis.provides` is in the inventory,
 *     so a newly registered reputation-bearing endpoint cannot ship unclassified.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as Disclosure from '../../packages/shared/src/schemas/reputationDisclosure';

const ROOT = path.resolve(__dirname, '..', '..');
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'services/registry.json'), 'utf8'));
const inventory = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'tests/fixtures/reputation-disclosure-inventory.json'), 'utf8'),
);

type Entry = {
  service: string;
  method: string;
  path: string;
  class: string;
  schema: string;
  contract_test: string;
  sample_response?: unknown;
  denial_fixture?: { success?: unknown; message?: unknown; error?: unknown };
};

const entries: Entry[] = inventory.endpoints;
const key = (e: { service: string; method: string; path: string }) =>
  `${e.service} ${e.method.toUpperCase()} ${e.path}`;

describe('reputation disclosure gate — inventory shape', () => {
  it('has a non-empty endpoint inventory', () => {
    expect(Array.isArray(entries)).toBe(true);
    expect(entries.length).toBeGreaterThan(20);
  });

  it.each(entries.map((e) => [key(e), e] as const))('%s is well-formed', (_k, entry) => {
    expect(entry).toEqual(
      expect.objectContaining({
        service: expect.any(String),
        method: expect.stringMatching(/^(GET|POST|PUT|DELETE|PATCH)$/),
        path: expect.stringMatching(/^\//),
        class: expect.stringMatching(/^(self|ordinary_member|provider|community_aggregate|internal)$/),
        schema: expect.any(String),
        contract_test: expect.any(String),
      }),
    );
    expect(fs.existsSync(path.join(ROOT, entry.contract_test))).toBe(true);
  });

  it('has no duplicate endpoint keys', () => {
    const keys = entries.map(key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('reputation disclosure gate — schema binding', () => {
  const SENTINEL_SCHEMAS = new Set([
    'self_only',
    'provider_public',
    'community_aggregate',
    'community_policy',
    'internal_admin_policy',
    'internal_identity_projection',
    'retired_410',
  ]);

  it.each(entries.map((e) => [key(e), e] as const))(
    '%s names a real shared schema or an approved sentinel',
    (_k, entry) => {
      const isRealExport = Object.prototype.hasOwnProperty.call(Disclosure, entry.schema);
      const isSentinel = SENTINEL_SCHEMAS.has(entry.schema);
      expect(isRealExport || isSentinel).toBe(true);
    },
  );

  it('binds ordinary_member graph/path/governance endpoints to a strict shared schema', () => {
    const ordinaryWithRealSchema = entries.filter(
      (e) => e.class === 'ordinary_member' && Object.prototype.hasOwnProperty.call(Disclosure, e.schema),
    );
    // At least the graph, path, and governance contracts must use a real strict schema.
    expect(ordinaryWithRealSchema.length).toBeGreaterThanOrEqual(3);
  });
});

describe('reputation disclosure gate — protected fixtures carry no forbidden keys', () => {
  const ordinaryProtected = entries.filter(
    (e) => e.class === 'ordinary_member' && e.sample_response !== undefined,
  );
  const selfProtected = entries.filter(
    (e) => e.class === 'self' && e.sample_response !== undefined,
  );

  // A self response may legitimately carry the CALLER's own karma/trust_score, but it must never
  // embed another member's edge weight or a peer-derived aggregate.
  const FORBIDDEN_PEER_KEYS = new Set([
    'raw_weight',
    'effective_weight',
    'currentWeight',
    'current_weight',
    'avg_invitee_karma',
    'avg_invitee_trust_score',
  ]);
  const findPeerKeys = (value: unknown, trail = '$'): string[] => {
    const out: string[] = [];
    if (Array.isArray(value)) {
      value.forEach((v, i) => out.push(...findPeerKeys(v, `${trail}[${i}]`)));
    } else if (value !== null && typeof value === 'object') {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (FORBIDDEN_PEER_KEYS.has(k)) out.push(`${trail}.${k}`);
        out.push(...findPeerKeys(v, `${trail}.${k}`));
      }
    }
    return out;
  };

  it('every ordinary_member entry that is not retired/denial-only ships a sample_response', () => {
    // ordinary_member responses must be key-clean and are proven so via their fixture. (self
    // responses legitimately contain the caller's own metrics; they are guarded by self-only auth,
    // verified in each endpoint's contract_test, not by a key scan.)
    const needsSample = entries.filter(
      (e) =>
        e.class === 'ordinary_member' &&
        e.schema !== 'retired_410' &&
        e.denial_fixture === undefined,
    );
    for (const e of needsSample) {
      expect(e.sample_response).toBeDefined();
    }
  });

  it.each(ordinaryProtected.map((e) => [key(e), e] as const))(
    'ordinary_member %s sample_response has no forbidden reputation key (full set)',
    (_k, entry) => {
      expect(() => Disclosure.assertNoForbiddenReputationKeys(entry.sample_response)).not.toThrow();
    },
  );

  it.each(selfProtected.map((e) => [key(e), e] as const))(
    'self %s sample_response embeds no peer metric (peer-only set)',
    (_k, entry) => {
      expect(findPeerKeys(entry.sample_response)).toEqual([]);
    },
  );

  it('sample_response conforms to its named strict schema when one is bound', () => {
    for (const entry of [...ordinaryProtected, ...selfProtected]) {
      const schema = (Disclosure as Record<string, unknown>)[entry.schema];
      if (schema && typeof (schema as { parse?: unknown }).parse === 'function') {
        expect(() => (schema as { parse: (v: unknown) => unknown }).parse(entry.sample_response)).not.toThrow();
      }
    }
  });
});

describe('reputation disclosure gate — ADR-074 denial envelopes', () => {
  const denials = entries.filter((e) => e.denial_fixture !== undefined);

  it('has denial fixtures for retired endpoints and cross-user config routes', () => {
    expect(denials.length).toBeGreaterThanOrEqual(3);
  });

  it.each(denials.map((e) => [key(e), e] as const))(
    '%s denial_fixture is an ADR-074 string-code envelope',
    (_k, entry) => {
      const d = entry.denial_fixture!;
      expect(d.success).toBe(false);
      expect(typeof d.message).toBe('string');
      expect(typeof d.error).toBe('string');
      expect((d.error as string).length).toBeGreaterThan(0);
    },
  );

  it('every :userId reputation/config route has an explicit cross-user denial fixture', () => {
    const userIdRoutes = entries.filter(
      (e) => /:userId/.test(e.path) && (e.class === 'self') && e.service === 'reputation-service',
    );
    expect(userIdRoutes.length).toBeGreaterThan(0);
    for (const e of userIdRoutes) {
      expect(e.denial_fixture).toBeDefined();
    }
  });
});

describe('reputation disclosure gate — registry <-> inventory drift (both directions)', () => {
  const registryClassified: Array<{ service: string; method: string; path: string; class: string }> =
    (registry.reputation_disclosure && registry.reputation_disclosure.endpoints) || [];

  it('the registry declares a reputation_disclosure classification block', () => {
    expect(Array.isArray(registryClassified)).toBe(true);
    expect(registryClassified.length).toBeGreaterThan(20);
  });

  it('every registry classification has a matching inventory entry with the same class', () => {
    const invByKey = new Map(entries.map((e) => [key(e), e.class]));
    for (const r of registryClassified) {
      const k = key(r);
      expect(invByKey.has(k)).toBe(true);
      expect(invByKey.get(k)).toBe(r.class);
    }
  });

  it('every inventory entry has a matching registry classification with the same class', () => {
    const regByKey = new Map(registryClassified.map((r) => [key(r), r.class]));
    for (const e of entries) {
      const k = key(e);
      expect(regByKey.has(k)).toBe(true);
      expect(regByKey.get(k)).toBe(e.class);
    }
  });
});

describe('reputation disclosure gate — newly registered endpoints cannot ship unclassified', () => {
  // Sensitive READ roots whose appearance in apis.provides demands an inventory classification.
  // This is a curated reputation-bearing surface, not a blanket word ban.
  const SENSITIVE_READ_PATTERNS = [
    /leaderboard/i,
    /community-trust/i,
    /community-health/i,
    /network-metrics/i,
    /milestones/i,
    /trust-config/i,
    /effective-params/i,
    /evolution-global/i,
    /\/trust\/graph/i,
    /\/trust\/neighborhood/i,
    /trust-card/i,
    /\/trust\/me\/memory/i,
    /\/trust\/relationships/i,
    /\/trust\/edge/i,
    /decay-config/i,
    // Sprint 112 cross-agent review: feed + dibs read surfaces that disclose requester/candidate
    // reputation must be classified. (Specific paths, not a broad `dibs`/`stats` match, so the dibs
    // WRITE routes and provider-collective stats aren't false-flagged.)
    /\/requests\/curated/i,
    /dibs-candidate/i,
  ];
  // Known paths that match a sensitive pattern but are accounted for elsewhere:
  //  - the first two are abbreviated registry aliases of canonical `/reputation/...` inventory
  //    entries (the registry lists them without the `/reputation` mount prefix);
  //  - the feed pulse is request-service's non-identifying weekly community aggregate, outside the
  //    reputation-disclosure boundary (no member-level reputation).
  const ALLOWLIST = new Set<string>([
    '/karma/leaderboard',
    '/community-trust/:communityId',
    '/requests/feed/community-health',
  ]);

  const inventoryPaths = new Set(entries.map((e) => e.path));

  const flagged: string[] = [];
  for (const [, cfg] of Object.entries<any>(registry.services)) {
    const provides = (cfg.apis && cfg.apis.provides) || [];
    for (const p of provides) {
      const pathStr: string = typeof p === 'string' ? p.replace(/^(GET|POST|PUT|DELETE|PATCH)\s+/i, '') : p.path;
      if (!pathStr) continue;
      const sensitive = SENSITIVE_READ_PATTERNS.some((re) => re.test(pathStr));
      if (sensitive && !ALLOWLIST.has(pathStr) && !inventoryPaths.has(pathStr)) {
        flagged.push(pathStr);
      }
    }
  }

  it('all sensitive READ roots in apis.provides are classified in the inventory', () => {
    expect(flagged).toEqual([]);
  });
});
