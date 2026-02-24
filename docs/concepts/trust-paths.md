# How Trust Paths Work

Trust paths trace the chain of real relationships connecting you to any member in your community — and display them as compact badges in your feed.

---

## The Three Layers of Connection

When computing a trust path, the system tries three methods in order of strength:

### 1. Exchange Graph (Strongest)

The primary trust signal is a completed exchange — you actually helped someone, or they helped you. Every completed match creates a bidirectional trust edge between the requester and the helper.

Paths are computed using a **Breadth-First Search** across the platform-wide exchange graph, up to a maximum of 4 degrees of separation.

**Examples:**
- 1° — You and this person have directly completed an exchange
- 2° — You share a mutual helper: You ↔ Alex ↔ them
- 3° — One more step: You ↔ Alex ↔ Maria ↔ them

The **trust score** for an exchange path is the sum of karma held by all intermediate nodes — the people standing between you and the requester.

### 2. Community Membership (Fallback)

If no exchange path exists, the system checks whether you and the requester are both active members of the same community. The community admin (or creator) acts as the shared anchor:

- If the admin is one of the two users → **1° community connection**
- Otherwise → **2° connection** through the admin: You ↔ Admin ↔ them

### 3. Invitation Chain (Last Resort)

If neither an exchange path nor shared community membership exists, the system searches the invitation lineage — who invited whom. An accepted invitation creates a bidirectional trust edge, and the BFS runs up to 3 degrees.

---

## The Badge Colors

The compact badge in the feed reflects both the connection type and the degree:

| Badge | Meaning |
|---|---|
| 🔗 Direct connection (green) | 1° exchange — you've worked together |
| 🤝 Connected through... (blue) | 2° exchange — one mutual helper |
| 👥 (gray) | 3° exchange — two steps removed |
| 🏘 Fellow member (purple) | Shared community (no direct exchange) |
| 🤝 Joined through... (yellow) | Invitation chain connection |

Badges are only shown for connections up to 3 degrees. Requests from people 4+ degrees away show no badge.

---

## Caching

Computed paths are stored in `auth.social_distances` with a **7-day TTL**. The cache is invalidated immediately when a new exchange completes between two users — the direct edge now exists, so any cached indirect path is stale.

---

## Related

- [Trust Score](/docs/concepts/trust-score)
- [ADR-019: Referral Chain Trust System](/docs/concepts/adr-019-referral-chain-trust)
- [ADR-021: Configurable Trust Path Filtering](/docs/concepts/adr-021-trust-path-filtering)
- [ADR-034: Multi-Layer Trust Path Computation](/docs/concepts/adr-034-multi-layer-trust-computation)
