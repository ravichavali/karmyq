/**
 * Sprint 116 — reciprocal relationship context.
 *
 * The outward contract exposes authenticated, request-scoped identity and topology. It deliberately
 * exposes a coarse ordinal history band while keeping exact interaction counts, weights, reputation,
 * karma, timestamps, and exchange content internal.
 */
import { z } from 'zod';
import { PROVIDER_SERVICE_TYPES } from './providers';
import { RelationshipStateSchema } from './reputationDisclosure';

export const BondDepthSchema = z.enum(['forming', 'growing', 'established']);
export type BondDepth = z.infer<typeof BondDepthSchema>;

/**
 * Convert an internal interaction count to its deliberately ordinal outward band.
 * `forming` is also the defensive fallback for zero/invalid counts; it never overstates history.
 */
export function classifyBondDepth(interactionCount: number): BondDepth {
  if (interactionCount >= 4) return 'established';
  if (interactionCount >= 2) return 'growing';
  return 'forming';
}

export const ContextIdentitySchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1),
  })
  .strict();
export type ContextIdentity = z.infer<typeof ContextIdentitySchema>;

export const ContextCommunitySchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1),
  })
  .strict();
export type ContextCommunity = z.infer<typeof ContextCommunitySchema>;

export const ContextNodeSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1),
    communities: z.array(ContextCommunitySchema),
  })
  .strict();
export type ContextNode = z.infer<typeof ContextNodeSchema>;

const MemberCounterpartSchema = ContextIdentitySchema.extend({
  role: z.literal('member'),
}).strict();

const ProviderCounterpartSchema = ContextIdentitySchema.extend({
  role: z.literal('provider'),
  provider: z
    .object({
      serviceType: z.enum(PROVIDER_SERVICE_TYPES),
      collectiveName: z.string().min(1).optional(),
    })
    .strict(),
}).strict();

export const ContextCounterpartSchema = z.discriminatedUnion('role', [
  MemberCounterpartSchema,
  ProviderCounterpartSchema,
]);
export type ContextCounterpart = z.infer<typeof ContextCounterpartSchema>;

export const ContextLinkSchema = z
  .object({
    source: z.string().uuid(),
    target: z.string().uuid(),
    relationship_state: RelationshipStateSchema,
    bond_depth: BondDepthSchema,
  })
  .strict();
export type ContextLink = z.infer<typeof ContextLinkSchema>;

export const RelationshipContextSchema = z
  .object({
    viewer: ContextIdentitySchema,
    counterpart: ContextCounterpartSchema,
    request: z
      .object({
        id: z.string().uuid(),
        visibilityScope: z.enum(['community', 'trust_network', 'platform']),
        reachability: z.enum([
          'same_community',
          'sister_community',
          'trust_network',
          'platform',
        ]),
      })
      .strict(),
    path: z
      .object({
        scope: z.literal('platform'),
        degrees: z.number().int().min(1).max(6).nullable(),
        nodes: z.array(ContextIdentitySchema),
      })
      .strict(),
    networks: z
      .object({
        viewer: z.array(ContextNodeSchema),
        counterpart: z.array(ContextNodeSchema),
        shared: z.array(ContextNodeSchema),
        truncated: z.boolean(),
      })
      .strict(),
    links: z.array(ContextLinkSchema),
    summary: z.string().min(1),
  })
  .strict();

export type RelationshipContext = z.infer<typeof RelationshipContextSchema>;

// Plan/API spelling retained as a direct alias while exported schema constants follow repo style.
export const relationshipContextSchema = RelationshipContextSchema;
