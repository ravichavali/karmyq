# ADR-086: Scale Answers — One Question per Zoom Level

**Status**: Accepted
**Date**: 2026-07-15
**Sprint**: 119
**Version**: 11.29.0
**Builds on**: [ADR-082](ADR-082-reputation-disclosure-boundary.md) (qualitative disclosure), [ADR-083](ADR-083-contextual-belonging-graph-rendering.md) (earned structure), [ADR-085](ADR-085-invited-arrival-and-edge-lifecycle.md) (living ego graph)

## Context

Sprint 114 removed a graph presentation that inferred groups and visual hierarchy the disclosed
topology did not contain. ADR-083 replaced it with deterministic, earned structure, and ADR-085
gave the ego scale a living answer: **which of my bonds are growing or fading?** The two wider
scales were structurally truthful but still required a member to interpret the whole picture
without an immediate question to orient them.

The community ring also placed members in a stable neutral order without anchoring the viewer,
while the across-communities hub rendered every organic tie similarly even though the member's
primary question concerns the communities they actually belong to.

## Decision

**Each belonging-graph zoom level answers one viewer-relevant question using only disclosed,
server-supported structure. Presentation may emphasize facts; it must never manufacture them.**

### Scale 1 · My Network: “Which bonds are growing or fading?”

ADR-085 remains the governing decision. New bonds receive qualitative green emphasis, while the
existing decay bands show strong, warm, fading, and nearly forgotten relationships. No timestamp,
count, or exact reputation value is disclosed.

### Scale 2 · This Community: “Where do you fit?”

- Rotate the existing deterministic member order so the viewer sits at 12 o'clock. This is rotation
  only: membership, cyclic order, radius, and chord geometry do not change.
- Keep the viewer's chords at their existing decay-band opacity and quiet non-viewer chords by one
  shared factor. Focus behavior still lifts the focused neighborhood over the default state.
- State the answer in words: “You're bonded with N of M members here,” or the honest no-bonds
  invitation to help someone. If the viewer is not in the returned graph, do not invent a viewer
  anchor or summary.
- Preserve the shipped `new > caller > focused` stroke precedence and every decay-band value.

The community scale deliberately does **not** use weaving/fraying timestamps. It answers where the
viewer fits now, not when community relationships formed.

### Scale 3 · Across Communities: “Which of your communities are woven together?”

- An organic bridge whose endpoints are both communities the viewer belongs to is a woven bridge.
  Bridges to visible periphery communities remain present but quiet.
- `active_recently: boolean` says whether a woven bridge has had an exchange within the shared
  30-day qualitative window. It is derived server-side, fail-closed, from
  `community_trust_edges.last_interaction_at`; the timestamp never leaves the service.
- A recently active woven bridge reuses the new-bond green family. A dormant woven bridge remains
  structurally emphasized in width but visually quiet. Fission lineage retains its dashed violet
  encoding unchanged.
- The flag survives the canonical normalization boundary as `activeRecently`; renderers do not
  infer activity from weights or dates.

## Consequences

### Positive

- A member gets a five-second answer at every scale without reading a metric or learning a new
  layout language.
- Viewer anchoring and emphasis are deterministic overlays on disclosed topology, so the graph
  remains truthful and stable under interaction.
- Bridge aliveness is qualitative and server-derived, preserving ADR-082 while distinguishing a
  living connection from a dormant structural tie.
- The three scales form one coherent story: bonds live over time, the viewer has a place within a
  community, and communities themselves can be woven together.

### Negative / trade-offs

- Quieting non-viewer chords reduces their default salience; focus remains available to restore a
  neighborhood's full qualitative bands.
- Sparse inter-community data can make the hub look calm. That is an honest property of the current
  graph, not a reason to synthesize bridges.
- `active_recently` adds one outward boolean and a database timestamp read to the depth-graph query.

## Alternatives considered

- **Weaving/fraying at the community-ring scale** — rejected: it answers a different question and
  would require formation data the community graph does not currently disclose.
- **Rank or enlarge central people** — rejected: importance would be inferred from layout or graph
  metrics and would recreate the presentation problem ADR-083 removed.
- **Derive bridge activity in the browser from weight** — rejected: weight is not recency, and raw
  metric interpretation belongs behind the disclosure boundary.
- **Expose `last_interaction_at`** — rejected: the qualitative boolean is sufficient and avoids a
  triangulatable timestamp.
- **Change the ring layout to put the viewer in a new geometry** — rejected: rotation answers the
  question without disturbing the deterministic structure members already learned.
