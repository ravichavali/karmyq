# ADR-063: Canonical Decayed Trust Metric & Unified Graph Visualization

**Status**: Implemented
**Date**: 2026-05-31
**Deciders**: Engineering

> **Amended by [ADR-083](ADR-083-contextual-belonging-graph-rendering.md) (Sprint 115):** the unified
> *single-renderer* visualization is partially superseded — person graphs now render through
> deterministic, context-specific renderers (ego orbits, community ring) instead of one HEB radial,
> because force/HEB layouts and greedy cluster detection manufacture structure the data doesn't
> contain. The canonical decayed trust metric, the privacy boundary, and uniform person-node sizing
> from this ADR are preserved; only the one-universal-renderer choice changes.

## Context

Karmyq accumulated several trust-graph views that drifted apart on two axes:

1. **The trust metric was inconsistent.** Node `trust_score` in the ego graph
   functions (`getTrustGraph`, `getTrustGraphAggregate`,
   `getTrustGraphAggregateForCenter`) was summed from `raw_weight` on
   `social_graph.trust_edges` — the *undecayed* interaction total. Edges in those
   same responses, and the whole full-community graph (`getFullCommunityGraph`),
   already used the decay-adjusted `current_weight` from the
   `social_graph.trust_edges_live` view. So a node's size and its incident edges
   could tell contradictory stories: a dormant relationship still inflated the
   node even though every edge had decayed.

2. **The visualizations were stylistically divergent.** Relationship views were
   spread across three rendering engines: a D3 hierarchical-edge-bundling (HEB)
   clustered view (community + fission), a Cytoscape concentric *radial* view
   ("My Network"), and a `react-force-graph` hairball ("Your Network" on the
   dashboard, with progressive click-to-expand). Each encoded trust differently,
   and two of them double-encoded it as node area, making large hubs dominate and
   structure (clusters, bridges) hard to see.

## Decision

**1. The canonical trust metric is decayed (`current_weight`), everywhere.**
The node `trust_score` aggregate in the three ego functions now reads
`SUM(current_weight)` from `social_graph.trust_edges_live`, matching the edges
and the full-community graph. `trust_edges_live` is the single source of truth
for "how much trust exists right now"; `raw_weight` on `trust_edges` is retained
only as the pre-decay accumulator behind the view.

**2. One visual language: clustered HEB with uniform node sizing.**
All relationship views — Community, Split/Fission, "My Network", and the
dashboard "Your Network" — render through the existing D3 HEB component, now with
an `ego` mode. Node area no longer encodes trust: every node is the same size,
and only the current user is enlarged and white-ringed so "you" stays findable.
Trust is read from **edges and clusters** (within-cluster vs cross-cluster,
amber for the user's own edges), not dot size. The Cytoscape radial and
`react-force-graph` implementations (and their dependencies) were retired, and
the dashboard view lost its progressive expansion in favor of a static
first-degree aggregate.

**3. A new inter-community depth view.**
`GET /trust/communities` returns communities-as-nodes for the calling user: their
active communities plus any community reachable by an inter-community edge.
Edges are tagged by type — **organic** (undirected, from
`social_graph.community_trust_edges`, drawn solid with width ∝ weight) and
**fission** (directed parent→child, from executed `communities.split_proposals`,
drawn dashed in violet). This makes community lineage and cross-community trust
legible for the first time. No schema changes were required — every input table
already existed.

## Consequences

- Node size is no longer a trust signal anywhere; users and docs must read trust
  from edges/clusters. This is a deliberate trade: structure-revealing over
  magnitude-at-a-glance.
- The metric change can lower visible node "prominence" for relationships that
  have decayed — this is correct, not a regression.
- Removing `cytoscape`, `react-cytoscapejs`, and `react-force-graph-2d` shrinks
  the frontend bundle and the dependency/security surface.
- `community_trust_edges` is often sparse, so the depth view leans on fission
  lineage as the denser structural signal; that is expected.

## Alternatives Considered

- **Keep per-view styling, only fix the metric.** Rejected — the inconsistent
  metric was the acute bug, but the divergent visuals were the chronic usability
  cost; fixing both together is cheaper than twice.
- **Size nodes by decayed trust.** Rejected — uniform sizing reads better at the
  community scale and keeps every view honest about the same single metric.
