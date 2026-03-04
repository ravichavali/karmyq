# ADR-043: Three-Score Model — Karma, Personal Trust, and Provider Trust

**Status**: Implemented
**Date**: 2026-03-04
**Author**: Core Team

---

## Context

Karmyq users accumulate three distinct reputation signals as they participate on the platform:

1. **Karma** — a currency-like score earned by giving and receiving help
2. **Personal Trust Score** — a relational reputation within a community (0–100)
3. **Provider Trust Score** — a commercial-reliability score for users who register as service providers (0–100)

As the platform grew across two layers (mutual-aid communities + professional services), confusion arose about how these scores relate to each other. Users, designers, and developers asked:

- Does karma feed into trust?
- Does a high personal trust score boost your provider trust score?
- Are these the same number shown in different places?

This ADR establishes the canonical answer: **the three scores are intentionally independent and do not feed into each other**.

---

## Decision

### Score 1 — Karma (Layer 1 currency)

- **What it measures**: Accumulated participation value — how much help you've given and received, weighted by community karma configs.
- **How it's earned**: Completing matches awards karma to both the helper (60% default split) and the requester (40%).
- **Decay**: Exponential decay with a 6-month half-life (ADR-011). Old karma fades; continued participation is rewarded.
- **Stored in**: `reputation.karma_records`
- **Visible to**: Community members — displayed on community dashboards and leaderboards.

### Score 2 — Personal Trust Score (Layer 1 relational)

- **What it measures**: Trustworthiness as a mutual-aid peer within a specific community.
- **Inputs**: Interaction frequency (depth), breadth of distinct people helped, and weighted feedback ratings (helpfulness / responsiveness / clarity).
- **Formula**: Configurable per community via `community_configs` (ADR-037). Default: 60% depth, 40% breadth with feedback bonus.
- **Cross-community carry**: A decayed fraction (default 40%) of your best score elsewhere can serve as a floor in a new community (ADR-038).
- **Stored in**: `reputation.trust_scores`
- **Visible to**: Community members and the community admin dashboard.

### Score 3 — Provider Trust Score (Layer 2 commercial reliability)

- **What it measures**: Reliability as a professional service provider — whether you show up and complete what you agreed to.
- **Inputs**: Average star rating from reviews (60%), completion rate — completed matches / accepted matches (30%), response rate (10%).
- **How completion_rate is updated**: The reputation service listens to `match_completed` events; if the responder has an active provider profile, it recalculates their `completion_rate` on `reputation.provider_trust_scores`.
- **Stored in**: `reputation.provider_trust_scores` (one row per provider profile)
- **Visible to**: Anyone browsing provider listings (public).

---

## Why the Three Scores Are Independent

**Karma ≠ Trust**: A community elder with high karma may have earned it all two years ago and been inactive since. A newcomer with low karma may be highly responsive and helpful. Trust captures current behaviour; karma captures accumulated contribution.

**Personal Trust ≠ Provider Trust**: Being a great mutual-aid neighbour (showing up, being responsive, completing requests) does not automatically make you a reliable professional service provider, and vice versa. The Layer 2 trust score is specifically about commercial-adjacent reliability. Blending them would reward unrelated behaviour.

**Provider Trust does not gate community access**: A provider trust score of 0 does not exclude you from community participation. A personal trust score of 100 does not lower the bar for provider registration. The gates between layers are one-way and optional (community admins choose whether to surface the provider directory, and can set a minimum personal trust threshold for listing — but that threshold is a hard gate, not a score blend).

---

## Consequences

- **Clarity for users**: Each score answers a different question. Docs and UI labels must use the correct name.
- **No cascade bugs**: A bug in the provider trust recalculation cannot corrupt personal trust scores or karma.
- **Independent evolution**: Each score formula can be changed without affecting the others.
- **Implementation constraint**: The reputation service MUST NOT read `provider_trust_scores` when computing `trust_scores`, and vice versa.

---

## Related ADRs

- ADR-011: Reputation Decay (karma half-life)
- ADR-035: Karma Allocation and Trust Score Strategy
- ADR-037: Multi-Signal Trust Score
- ADR-038: Cross-Community Trust Carry
- ADR-041: Two-Layer Mutual Aid + Services
- ADR-042: Provider Trust Score
