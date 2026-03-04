# Community Scale: The Fractal Community Model

**Status**: Implemented (Sprint 15)
**Related ADRs**: [ADR-017](../adr/ADR-017-cohort-based-community-layers.md), [ADR-018](../adr/ADR-018-community-splitting-mechanics.md)

---

## Why Scale Matters

Communities that work well at 30 people often break at 300. This isn't a bug — it's Dunbar's Number in action. Human beings can maintain roughly 150 meaningful relationships. Beyond that, social trust becomes diffuse, coordination costs rise, and the mutual-aid fabric that makes a community valuable starts to fray.

Karmyq's approach: **keep communities human-scale, but let them connect**.

---

## The Five-Level Hierarchy (Vision)

```
Network      — federated trust across the platform
  Region     — geographic or thematic cluster of clusters
    Cluster  — a group of sister communities
      Community — the core unit (target: <150 members)
        Individual
```

Sprint 15 implements the **Community ↔ Cluster** layer: voluntary links between peer communities.

---

## Community Links

Communities can form three kinds of relationships:

| Link Type | Meaning | Trust Carry |
|-----------|---------|-------------|
| `sister` | Peer communities with shared values/geography | 0.40 (default) |
| `parent_child` | One community spawned from another | 0.60 |
| `split_origin` | Two communities formed from a split | 0.50 |

**Trust carry factor** (0.00–1.00) scales how much of a member's trust score is visible across the link. A 0.40 factor means a member with trust score 80 in Community A appears as 32 in Community B's context.

### Proposing a Link

Either community admin proposes a link. The other community's admin must approve it. Both admins can remove it at any time.

```
Community A admin                Community B admin
  POST /communities/A/links   →   (pending)
                              ←   PUT /communities/A/links/:id  (approve)
                                  link is now active
```

### Sister Feeds

When `show_in_sister_feeds = true` on a link, the curated feed (`GET /requests/curated`) includes requests from the sister community, scored at `trust_carry_factor × original_score`. This lets members see across community boundaries without fully merging.

---

## Dunbar Pressure and Splitting

When a community grows beyond ~120 members, it experiences "Dunbar pressure": interactions become thinner, trust scores converge toward the mean, and smaller affinity groups form naturally.

Karmyq surfaces this through:
1. **Cohort layers** (ADR-017): Inner Circle / Active / Extended Network — computed from interaction frequency
2. **Split proposals** (ADR-018): Admin-initiated process to divide a community, preserving `split_origin` links between the resulting communities

---

## Design Principles

- **Small is the goal**: Communities are capped (configurable, default 150) to preserve cohesion
- **Links are explicit, not automatic**: No community is absorbed without admin agreement on both sides
- **Trust doesn't teleport**: Trust carry is fractional — cross-community trust is always less than home-community trust
- **Reversible**: Links can be deactivated without data loss

---

## Database Schema

```sql
-- communities.community_links
id                UUID PK
community_a_id    UUID → communities.communities
community_b_id    UUID → communities.communities
link_type         TEXT ('sister' | 'parent_child' | 'split_origin')
trust_carry_factor NUMERIC(3,2) DEFAULT 0.40
show_in_sister_feeds BOOLEAN DEFAULT FALSE
created_by_admin_a UUID
created_by_admin_b UUID
status            TEXT ('pending' | 'active' | 'inactive')
created_at        TIMESTAMPTZ
```

---

## API Surface

### Community Service (port 3002)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/communities/:id/links` | Propose a link (admin-only) |
| PUT | `/communities/:id/links/:linkId` | Approve or update a link |
| GET | `/communities/:id/links` | List links for a community |
| DELETE | `/communities/:id/links/:linkId` | Remove a link |

### Feed Service (port 3007)

`GET /requests/curated` now accepts `?includeSisterCommunities=true` — adds requests from linked communities where `show_in_sister_feeds = true`, scored by trust_carry_factor.

---

## Future Work

- **Region layer**: grouping of sister-community clusters for federated governance
- **Cohort layer features** (ADR-017 Phase 2): inner-circle-only requests, prioritized notifications
- **Split workflow** (ADR-018): guided admin tool for community splitting with vote mechanism
