# ADR-095: Authenticated Provider Directory and Reach-Gated Standing

**Status**: Accepted
**Date**: 2026-08-17
**Supersedes**: —
**Related**: ADR-041 (Two-Layer Mutual Aid + Professional Services), ADR-037 (Trust Scores), ADR-042 (Provider Trust Score), ADR-074 (API Response Contract)

---

## Context

Migration `022-provider-profiles.sql` added three columns to `communities.community_configs`:

```sql
provider_services_enabled          BOOLEAN  DEFAULT FALSE,
provider_min_personal_trust_score  INTEGER  DEFAULT 0,
provider_services_list             TEXT[]   DEFAULT '{}'
```

The admin UI wrote all three. **No service ever read any of them.** A steward could switch on
"provider services", set a standing floor, and nothing whatsoever changed — the platform-wide
directory behaved identically for every community. The switch was decoration.

At the same time, three read routes were fully public:

| Route | Service | Before |
|---|---|---|
| `GET /providers` | request | no auth — full directory enumeration |
| `GET /providers/:providerId` | request | no auth |
| `GET /providers/:providerId/rate-cards` | request | no auth |
| `GET /reputation/provider-trust/:providerId` | reputation | no auth — returns `display_name`, `service_type`, owner `user_id` |
| `GET /reputation/provider-reviews/:providerId` | reputation | no auth — returns review text **and `reviewer_name`** |

⚠️ The last two were found in code review, after the first three had been closed. Closing only the
request-service routes would have left the directory anonymously enumerable one hop sideways — and
`provider-reviews` was the worst of the five, returning the real names of members who left reviews.
**A surface is only as private as its most permissive route**; that is why the audit is by data
exposed, not by service.

ADR-041 described the directory as "publicly visible". In practice that meant anyone on the
internet could enumerate every provider profile on the platform — display name, bio, location
notes, pricing, and the owner's `user_id` — with no account.

## Decision

### 1. The directory requires authentication; it stays global

The three routes gain `authMiddleware`. This **narrows** ADR-041's "publicly visible" to "visible
to any authenticated user" — it does **not** community-gate the directory. Cross-community
discovery is the directory's purpose and remains intact.

Verified before changing: **no unauthenticated consumer exists.** The landing app never calls these
routes; simulation-service reaches them through a session client that always carries a token; the
frontend calls them authenticated. The change breaks no caller.

The now-dead `decodeOptionalViewer` helper is deleted rather than left in place. Dead auth-adjacent
code is the kind that gets re-wired by accident.

### 2. Standing gates REACH, not registration

A new `GET /providers/community/:communityId` applies the three-condition reach gate:

| Condition | Rule |
|---|---|
| `provider_services_enabled` | the community opted in at all |
| `provider_min_personal_trust_score` | provider's **personal standing in this community** clears the floor |
| `provider_services_list` | provider's `service_type` is allowed — **empty means ALL types** |

**ADR-041's global self-registration stands, unamended and not superseded.** Anyone may create a
provider profile and appear in the global directory. What a community controls is whether that
provider is surfaced to *its* members. Registration and reach are different questions, and
conflating them would have made community config a platform-wide gate on who may earn a living.

### 3. Unknown standing fails closed at 0

The trust-floor condition is `COALESCE(ts.score, 0) >= c.provider_min_personal_trust_score` over a
`LEFT JOIN`. A provider with no trust row in a community scores **0**, per ADR-037. Any floor above
0 therefore excludes members with no track record there yet — which is the intent.

⚠️ **A known inconsistency is deferred, not resolved:** `reputation.trust_scores.score` has
`DEFAULT 50`, so a row that *exists* starts at 50 while a row that *does not exist* is treated as
0. Two members with no activity can score differently depending only on whether some earlier
codepath inserted a row. This ADR fails closed at 0 deliberately; reconciling the DEFAULT is
separate work.

## Consequences

- **The three columns finally do something.** All three are enforced together — leaving one inert
  would have recreated the exact situation this ADR closes.
- **The path is `/providers/community/:communityId`, NOT `/communities/:id/providers`.**
  `nginx.conf:172-173` routes the `/api/communities` prefix to community-service, so the obvious
  path would never reach request-service. This one rides the existing `/api/requests` rule and
  needs no nginx change and no deploy ordering.
- **Route order is load-bearing.** `GET /:providerId` would capture the literal segment
  `community`. The new route is registered above it, as `/providers/my` already relies on, and a
  test asserts the resolution.
- **Membership is re-derived live** from `communities.members` (`status = 'active'`) for both
  viewer and provider. The JWT `communities` claim is a login-time snapshot: a removed member keeps
  it until their token refreshes, so a claim-only check would leak a community's provider layer to
  someone already shown the door.
- **Non-members get 403 before the layer is queried**, not a filtered result. A non-member learns
  nothing about a community's providers, including how many exist.
- **An unconfigured community returns an empty layer, not 404.** `config.ts` returns 404 for an
  absent config row; this surface must not, or a member could probe which communities exist.
- **Two different "trust" scores.** The floor filters `reputation.trust_scores.score`
  (user × community, ADR-037). Ordering uses `reputation.provider_trust_scores.trust_score`
  (provider profile quality, ADR-042). Substituting one for the other rejects an entirely different
  set of people, and both names are plausible enough that the error would read as correct.
- **Proof obligation.** The gate's *shape* is pinned by unit tests (LEFT JOIN, COALESCE,
  cardinality-means-all — each mutation-tested to fail); its *behaviour* — that it rejects, both
  directions, per condition — is proven by an integration test against PostgreSQL with RLS on.
  Mocked-DB tests cannot prove a SQL gate rejects, and are not claimed to.
