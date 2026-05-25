# ADR-053: Feed Design Philosophy

**Status**: Accepted
**Date**: 2026-05-25
**Deciders**: Karmyq core team

---

## Context

Karmyq has two types of feeds: the community Browse feed (where members find open requests) and the dashboard Active tab (where members track their commitments). Both need design principles grounded in the platform's purpose — not borrowed from social media.

Early design discussions revealed a risk: feed UIs are tempting to build as infinite scrollers with engagement mechanics because that's the dominant mental model from consumer social products. This ADR establishes the principles that prevent that drift.

---

## Decision

Karmyq feeds are designed as **work surfaces, not scroll surfaces**. Every design decision flows from this principle.

### 1. Purpose Determines Mechanics

The Browse feed exists to generate one action: someone offering help on an open request. Nothing else. Design choices must serve that action directly.

- No likes, reactions, or comments on feed items
- No follower counts or social graph metrics visible in the feed
- No trending or popular sections — these optimize for engagement, not help
- No infinite scroll by default — the feed ends when the actionable items end

### 2. Priority Order

Feed items are ranked in this order:
1. Requests the user has been proposed for (admin-matched) — most specific, act now
2. Requests the user has an active offer on — track these
3. Community requests matching the user's skills and availability
4. All other open community requests

Algorithmic ranking (trust-weighted scoring, urgency, recency, skill match) operates within tier 3. Tiers 1 and 2 are absolute — they are never displaced by algorithmic ranking.

### 3. Trust-Weighted Surfacing

Within the community request tier, requests are ranked by:
- **Trust distance**: requests from people 1–2 hops away in the trust graph surface higher
- **Skill match**: requests matching the viewer's listed skills
- **Urgency**: critical > high > medium > low
- **Recency**: newer requests preferred when other factors are equal
- **Admin boost**: a `+0.3` bonus applied after normalization for requests explicitly boosted by a community admin

Trust distance is computed from the social graph service. It biases the feed toward requests within the user's trusted network — but never hides requests from outside it.

### 4. Admin Boost Is the Only Curation Signal

Community admins and moderators can boost a request for 48 hours. This is the only human curation mechanism. Boosted requests display a "Community Pick" badge in member feeds.

There is no algorithmic trending. There is no editor's picks. There is no engagement-weighted popularity. The only signal that a request is "featured" is an explicit, time-limited decision by a community admin or mod.

### 5. The Feed Is Not a Social Graph

Karmyq has a trust graph and a social graph service. These are inputs to feed ranking, not outputs of it. The feed does not display:

- Mutual connections ("3 people you know helped this request")
- Social proof ("12 people viewed this")
- Follow/unfollow mechanics
- Notification-driven engagement loops

Trust is surfaced through matching quality, not social pressure.

### 6. Empty States Are Not Failures

When a user has no actionable items in their feed, the empty state should:
- Confirm the platform is working (no hidden requests)
- Suggest next actions (update skills, join more communities, post a request)
- Not manufacture urgency or fake activity

An empty feed means the user has no open obligations, which is a good state.

---

## Consequences

**Positive:**
- Feed UIs are easier to reason about — no engagement metrics to track or optimize
- Members trust the feed because it shows what's real, not what's algorithmically amplified
- Admin boost creates accountability — boosts are explicit, time-limited, and visible
- Platform stays focused on help completion, not engagement metrics

**Negative:**
- No viral mechanics — the platform grows through trust and word of mouth, not algorithmic reach
- Feed may feel "sparse" to users accustomed to social media density — this is by design

**Neutral:**
- Future feed features (e.g., member availability signals, provider-mode filtering) should be evaluated against these principles before implementation
