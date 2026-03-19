# Trust and Karma: Three Scores Explained

Karmyq tracks three reputation signals as you participate on the platform. They look similar on the surface, but each measures something distinct. They do not feed into each other — by design.

---

## The Three Scores at a Glance

| Score | Layer | What it measures | Who can see it |
|---|---|---|---|
| **Karma** | Community (Layer 1) | Accumulated contribution — how much help you've given and received | Community members |
| **Personal Trust** | Community (Layer 1) | Current trustworthiness as a mutual-aid peer | Community members and admins |
| **Provider Trust** | Services (Layer 2) | Reliability as a professional service provider | Anyone browsing providers (public) |

---

## Karma — The Community Currency

Karma is the unit of exchange within mutual-aid communities. When a match completes, both the helper and the requester earn karma points from a shared pool. The split is configurable per community (typically 60% to the helper, 40% to the requester).

Karma decays over time with a 6-month half-life. This means recent contributions count more than old ones. A member who helped ten neighbours last month has more active karma than one who helped ten neighbours three years ago — even if their raw totals are the same.

**Karma answers**: *How much have you contributed to this community, recently?*

---

## Personal Trust Score — Relational Reputation

Your personal trust score (0–100) reflects how much your community peers trust you as a mutual-aid partner. It's computed from:

- **Depth**: How many interactions you've completed in the last 12 months
- **Breadth**: How many distinct people you've helped or been helped by
- **Feedback**: Weighted average of helpfulness, responsiveness, and clarity ratings

The score is community-specific — you may have different trust scores in different communities, reflecting different participation levels. A cross-community carry system gives you a starting floor in a new community based on a decayed fraction of your best score elsewhere.

**Personal trust answers**: *How reliably do you show up for your neighbours right now?*

---

## Provider Trust Score — Commercial Reliability

If you register as a service provider (rides, trade work, tutoring, etc.), you earn a separate provider trust score. This is public-facing and tracks:

- **Star ratings** from post-match reviews (60% of the score)
- **Completion rate** — the share of accepted requests you followed through on (30%)
- **Response rate** — how quickly you respond to enquiries (10%)

Completion rate is updated automatically every time a match you were part of completes. Provider trust is specific to your provider profile, not your community membership.

**Provider trust answers**: *Can I rely on this person to deliver a service they've committed to?*

---

## Why They Don't Blend

You might expect a high personal trust score to boost your provider trust, or vice versa. We deliberately keep them separate:

- A community elder with years of mutual aid may have low provider trust because they're a new driver with few reviews.
- A highly-rated professional provider may have low personal trust in a community they recently joined.
- Blending the scores would penalise the wrong people and reward unrelated behaviour.

Each score answers a specific question. Mixing them would make all three answers less accurate.

---

## Related

- [Neighborhood Service Layer](neighborhood-service-layer) — how Layer 2 provider services work
- [ADR-043: Three-Score Model](adr-043-three-score-model) — the technical decision record

## Living Trust Models

Trust parameters are initial values, not permanent settings. Members can opt in to automatic calibration — their model adjusts gradually based on what actually happens in their exchanges. The goal is accuracy: a model that reflects lived experience, in whatever direction that experience points.
