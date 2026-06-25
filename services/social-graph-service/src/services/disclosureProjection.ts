/**
 * Sprint 112 — Social-graph disclosure projection (ADR-082).
 *
 * Person graph endpoints compute with rich internal rows (trust_score, karma, raw/effective edge
 * weights) for selection and decay classification, then project to privacy-safe outward shapes HERE,
 * at the response boundary. Outward person contracts carry identity + structure + a qualitative
 * relationship state — never another member's exact reputation or a raw edge weight.
 */
import { classifyDecayTier, type DecayTier } from '@karmyq/shared';
import type {
  RelationshipState,
  SafeBelongingNode,
  SafeBelongingLink,
} from '@karmyq/shared';

/** Map the ADR-070 decay tier to the outward relationship state. `swept` edges are not returned as
 *  bonds; if one slips through, present it as the weakest visible state. */
export function toRelationshipState(tier: DecayTier): RelationshipState {
  return tier === 'swept' ? 'nearly_forgotten' : tier;
}

/** Coarse relationship band for a decayed edge weight against a community disappearance threshold. */
export function relationshipState(weight: number, threshold: number): RelationshipState {
  return toRelationshipState(classifyDecayTier(weight, threshold));
}

interface RawNode {
  id?: string;
  user_id?: string;
  name?: string;
  isCurrentUser?: boolean;
  is_current_user?: boolean;
  degrees_of_separation?: number;
}

interface RawLink {
  source: unknown;
  target: unknown;
  effective_weight?: number;
  currentWeight?: number;
  decayTier?: DecayTier;
  type?: string;
}

function endpointId(value: unknown): string {
  if (value && typeof value === 'object') {
    const o = value as { id?: string; user_id?: string };
    return (o.id ?? o.user_id) as string;
  }
  return value as string;
}

/** Project a person graph node to identity + structure only (no trust_score/karma). */
export function projectPersonNode(node: RawNode, callerId?: string): SafeBelongingNode {
  const user_id = (node.user_id ?? node.id) as string;
  const safe: SafeBelongingNode = {
    user_id,
    name: node.name ?? 'Unknown',
    is_current_user:
      node.is_current_user ?? node.isCurrentUser ?? (callerId != null && user_id === callerId),
  };
  if (node.degrees_of_separation != null) {
    safe.degrees_of_separation = node.degrees_of_separation as SafeBelongingNode['degrees_of_separation'];
  }
  return safe;
}

/** Project a person graph link to source/target + qualitative relationship state (no raw weights). */
export function projectPersonLink(link: RawLink, threshold: number): SafeBelongingLink {
  const tier =
    link.decayTier ?? classifyDecayTier(Number(link.currentWeight ?? link.effective_weight ?? 0), threshold);
  const safe: SafeBelongingLink = {
    source: endpointId(link.source),
    target: endpointId(link.target),
    relationship_state: toRelationshipState(tier),
  };
  if (link.type === 'organic' || link.type === 'fission') safe.type = link.type;
  return safe;
}

export interface RawPersonGraph {
  nodes: RawNode[];
  links: RawLink[];
  meta?: unknown;
}

/**
 * Project a full person graph. `meta` (e.g. neighborhood depth/truncated) is structural and is
 * preserved as-is; it never carries member reputation.
 */
export function projectPersonGraph(
  graph: RawPersonGraph,
  threshold: number,
  callerId?: string,
): { nodes: SafeBelongingNode[]; links: SafeBelongingLink[]; meta?: unknown } {
  const safe: { nodes: SafeBelongingNode[]; links: SafeBelongingLink[]; meta?: unknown } = {
    nodes: graph.nodes.map((n) => projectPersonNode(n, callerId)),
    links: graph.links.map((l) => projectPersonLink(l, threshold)),
  };
  if (graph.meta !== undefined) safe.meta = graph.meta;
  return safe;
}

/**
 * Project a relationship-memory peer entry: keep caller-relative identity, decay tier, last
 * interaction, and completed-interaction count; drop the exact `currentWeight` (a peer's edge metric).
 */
export function projectMemoryRelationship<T extends { currentWeight?: number }>(
  rel: T,
): Omit<T, 'currentWeight'> {
  const { currentWeight: _omit, ...safe } = rel;
  return safe;
}

export interface RawMemoryResponse {
  activeCount: number;
  fading: Array<{ currentWeight?: number }>;
  nearlyForgotten: Array<{ currentWeight?: number }>;
}

/**
 * Project trust-path nodes to identity-only. Cached paths in auth.social_distances may have been
 * written BEFORE Sprint 112, when intermediate path nodes carried `karma`; this strips `karma` /
 * `trust_score` from every cached/returned node so a stale (≤7-day TTL) row can't leak another
 * member's reputation.
 */
export function projectPathNodes(path: unknown): unknown {
  if (!Array.isArray(path)) return path;
  return path.map((node) => {
    if (node && typeof node === 'object') {
      const { karma: _omitKarma, trust_score: _omitTrust, ...safe } = node as Record<string, unknown>;
      return safe;
    }
    return node;
  });
}

/** Project the relationship-memory response, stripping `currentWeight` from every peer entry. */
export function projectMemoryResponse(memory: RawMemoryResponse) {
  return {
    activeCount: memory.activeCount,
    fading: memory.fading.map(projectMemoryRelationship),
    nearlyForgotten: memory.nearlyForgotten.map(projectMemoryRelationship),
  };
}
