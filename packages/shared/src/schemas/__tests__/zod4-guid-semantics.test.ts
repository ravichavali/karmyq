/**
 * Sprint 131 D6 — P1: zod 4 must keep zod 3's id semantics.
 *
 * zod 4's `z.string().uuid()` enforces RFC 9562 version/variant nibbles; zod 3's accepted any
 * 8-4-4-4-12 hex. Postgres `uuid` is the arbiter, and our seeds/fixtures use ids like
 * 11111111-…, so every former `.uuid()` site is now `z.guid()`. Both halves are pinned per site:
 * a non-RFC id is ACCEPTED, and a malformed one is REJECTED on that site's own path.
 */
import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import path from 'path';
import type { ZodType } from 'zod';
import { commonValidators, communityParamsSchema, userParamsSchema } from '../../../middleware/validate';
import {
  ContextCommunitySchema,
  ContextIdentitySchema,
  ContextLinkSchema,
  ContextNodeSchema,
  RelationshipContextSchema,
} from '../relationshipContext';
import {
  GovernanceEligibleMemberSchema,
  GovernanceRoleHolderSchema,
  PublicMemberIdentitySchema,
  SafeBelongingNodeSchema,
  SafeTrustPathSchema,
  SelfCommunityReputationSchema,
} from '../reputationDisclosure';

const NON_RFC = '11111111-1111-1111-1111-111111111111';
const RFC_V4 = '75648739-6e64-4d8b-b594-0fd70f609d2d';
const MALFORMED = [
  'not-a-uuid',
  '11111111-1111-1111-1111-11111111111',
  '11111111111111111111111111111111',
  '{11111111-1111-1111-1111-111111111111}',
];

// Every id other than the one under test is RFC-valid, so it passes under either semantics.
const link = (source: string, target: string) => ({
  source,
  target,
  relationship_state: 'strong',
  bond_depth: 'forming',
});

const relationshipContext = (requestId: string) => ({
  viewer: { id: RFC_V4, name: 'Viewer' },
  counterpart: { id: RFC_V4, name: 'Counterpart', role: 'member' },
  request: { id: requestId, visibilityScope: 'community', reachability: 'same_community' },
  path: { scope: 'platform', degrees: null, nodes: [] },
  networks: { viewer: [], counterpart: [], shared: [], truncated: false },
  links: [],
  summary: 'You share a community.',
});

const selfCommunityReputation = (communityId: string) => ({
  scope: { type: 'community', community_id: communityId, community_name: 'Riverside' },
  reputation: { score: 50, scale_min: 0, scale_max: 100, tier: 'active', calculated_at: '2026-09-24T00:00:00Z' },
  karma: { current: 10, trend: 'stable', half_life_days: 90, calculated_at: '2026-09-24T00:00:00Z' },
  activity: { recent_helps: 1, recent_requests: 1, window_days: 30 },
});

type Case = { site: string; schema: ZodType; build: (id: string) => unknown; path: string };
const CASES: Case[] = [
  { site: 'validate.ts:115 commonValidators.uuid', schema: commonValidators.uuid, build: (id) => id, path: '' },
  { site: 'validate.ts:141 communityParamsSchema.communityId', schema: communityParamsSchema,
    build: (id) => ({ communityId: id }), path: 'communityId' },
  { site: 'validate.ts:148 userParamsSchema.userId', schema: userParamsSchema,
    build: (id) => ({ userId: id }), path: 'userId' },
  { site: 'relationshipContext.ts:27 ContextIdentitySchema.id', schema: ContextIdentitySchema,
    build: (id) => ({ id, name: 'Member' }), path: 'id' },
  { site: 'relationshipContext.ts:35 ContextCommunitySchema.id', schema: ContextCommunitySchema,
    build: (id) => ({ id, name: 'Riverside' }), path: 'id' },
  { site: 'relationshipContext.ts:43 ContextNodeSchema.id', schema: ContextNodeSchema,
    build: (id) => ({ id, name: 'Member', communities: [] }), path: 'id' },
  { site: 'relationshipContext.ts:72 ContextLinkSchema.source', schema: ContextLinkSchema,
    build: (id) => link(id, RFC_V4), path: 'source' },
  { site: 'relationshipContext.ts:73 ContextLinkSchema.target', schema: ContextLinkSchema,
    build: (id) => link(RFC_V4, id), path: 'target' },
  { site: 'relationshipContext.ts:86 RelationshipContextSchema.request.id', schema: RelationshipContextSchema,
    build: relationshipContext, path: 'request.id' },
  { site: 'reputationDisclosure.ts:50 PublicMemberIdentitySchema.user_id', schema: PublicMemberIdentitySchema,
    build: (id) => ({ user_id: id, name: 'Member' }), path: 'user_id' },
  { site: 'reputationDisclosure.ts:69 SelfCommunityReputationSchema.scope.community_id',
    schema: SelfCommunityReputationSchema, build: selfCommunityReputation, path: 'scope.community_id' },
  { site: 'reputationDisclosure.ts:111 GovernanceEligibleMemberSchema.user_id', schema: GovernanceEligibleMemberSchema,
    build: (id) => ({ user_id: id, name: 'Member', eligible: true, eligibility_reason: 'established_community_relationships' }),
    path: 'user_id' },
  { site: 'reputationDisclosure.ts:121 GovernanceRoleHolderSchema.user_id', schema: GovernanceRoleHolderSchema,
    build: (id) => ({ user_id: id, name: 'Member', role: 'admin' }), path: 'user_id' },
  { site: 'reputationDisclosure.ts:148 SafeBelongingNodeSchema.user_id', schema: SafeBelongingNodeSchema,
    build: (id) => ({ user_id: id, name: 'Member', is_current_user: false }), path: 'user_id' },
  { site: 'reputationDisclosure.ts:182 SafeTrustPathSchema.target_user_id', schema: SafeTrustPathSchema,
    build: (id) => ({ target_user_id: id, degrees_of_separation: null, path: [] }), path: 'target_user_id' },
];

it('covers every former .uuid() site exactly once', () => {
  expect(CASES).toHaveLength(15);
  expect(new Set(CASES.map((c) => c.site)).size).toBe(15);
});

describe.each(CASES)('$site', ({ schema, build, path: idPath }) => {
  it('accepts a non-RFC id (zod 3 semantics)', () => {
    expect(schema.safeParse(build(NON_RFC)).success).toBe(true);
  });
  it('accepts an RFC v4 id', () => {
    expect(schema.safeParse(build(RFC_V4)).success).toBe(true);
  });
  it.each(MALFORMED)('rejects %s on its own path', (bad) => {
    const result = schema.safeParse(build(bad));
    expect(result.success).toBe(false);
    // Exactly one issue, on this site's field: a fixture wrong elsewhere cannot make this pass.
    expect(result.error!.issues.map((i) => [i.path.join('.'), i.code])).toEqual([[idPath, 'invalid_format']]);
  });
});

describe('validate.ts custom messages survive (P2)', () => {
  it('commonValidators.uuid', () => {
    const r = commonValidators.uuid.safeParse('not-a-uuid');
    expect(r.error!.issues.map((i) => [i.path.join('.'), i.message])).toEqual([['', 'Invalid UUID format']]);
  });
  it('communityParamsSchema', () => {
    const r = communityParamsSchema.safeParse({ communityId: 'not-a-uuid' });
    expect(r.error!.issues.map((i) => [i.path.join('.'), i.message])).toEqual([['communityId', 'Invalid community ID']]);
  });
  it('userParamsSchema', () => {
    const r = userParamsSchema.safeParse({ userId: 'not-a-uuid' });
    expect(r.error!.issues.map((i) => [i.path.join('.'), i.message])).toEqual([['userId', 'Invalid user ID']]);
  });
});

it('no .uuid( remains in packages/shared source', () => {
  const root = path.resolve(__dirname, '../../..');
  const files = execFileSync('git', ['ls-files', '--', ':(glob)**/*.ts'], { cwd: root, encoding: 'utf8' })
    .split('\n')
    .filter((f) => f && !f.includes('__tests__') && !f.startsWith('dist/'));
  const offenders = files.filter((f) => /\.uuid\(/.test(readFileSync(path.join(root, f), 'utf8')));
  expect(offenders).toEqual([]);
});
