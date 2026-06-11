# Sprint 93 — Provider↔Community Link-Up: UX Audit

**Date:** 2026-06-10
**Auditor:** Claude (Opus 4.8), Sprint 93 execution
**Method:** Playwright walkthrough of the live demo (https://karmyq.com) + source-code confirmation
**Account:** `aisha.white6964@test.karmyq.com` (plain member; also holds provider profiles) — communities incl. Berkeley Community Care, PDX Rides Collective, Portland Tool Library & Share, etc.

---

## ⚖️ Ratified Scope (maintainer decision — 2026-06-10)

> **STATUS: RATIFIED — Full link-up incl. nav rework (F1 + F2 + F3).** At the Task 2 checkpoint
> the maintainer chose the broadest option: community-scoped provider discovery, onboarding
> community framing, AND restructuring the scattered member/provider dual-identity surfaces into a
> coherent provider home. Carry-forward bug fixes (Tasks 3–5) proceed regardless.

| Finding | Severity | Ship in S93? | Notes |
|---------|----------|--------------|-------|
| F1 — Provider directory has no community context | P1 | ✅ SHIP | Community scope + badge via existing memberships (no schema change) |
| F2 — Onboarding never mentions communities | P2 | ✅ SHIP | Community framing + which-communities surface on `/providers/new` |
| F3 — Dual-identity surfaces scattered | P2 | ✅ SHIP | Restructure mode toggle + My Provider Presence + collectives into a coherent provider home |
| F4 — False "worked with before" dibs copy | P1 | ✅ pre-ratified (Task 5) | `community_connection` reason |

---

## The core dissonance (one sentence)

Karmyq presents **mutual aid** through a rich community + trust lens, but presents the **same
platform's service providers** as a flat, context-free global directory — so a member gets two
opposite answers to "who is this person relative to my community?"

This is visible side-by-side in the product:

| Surface | How a person is framed |
|---------|------------------------|
| Dashboard mutual-aid feed | "From Sofia Davis · **PDX Rides Collective**", "**Direct connection**", "**Fellow member via** Maria Elena Reyes" — community + trust path on every card |
| `/providers` directory | "Omar — Tutoring", "David Fix It", generic blurb, **no community, no trust path** — a flat global list |

---

## Journey map & findings

Steps walked on the live demo (screenshots in this directory).

### 1. Login → Dashboard ✅ works
Plain member lands on a single unified feed ("One feed, ordered by what needs you"). Every feed
item carries community attribution and a trust path ("via X", "Direct connection"), plus a
**Community** selector and a "🔧 Services" category filter. Mutual aid is thoroughly
community-scoped. _(Snapshot: dashboard feed.)_

### 2. Browse `/providers` (member view) — **F1 (P1)**
**Screenshot:** `01-providers-member-view.png`
Header: "Neighborhood Service Providers — Paid neighborhood services alongside mutual aid — no
karma, your own arrangement." Below: a "My Provider Presence" panel (my profiles + my
collectives), tabs (Individual Providers / Collectives), category chips (All / Rides / Home
Repair / Tutoring / Other), then a grid of provider cards.

**Finding:** Not one provider card names a community. There is no "Providers in Berkeley
Community Care", no community badge, no shared-community grouping, no trust path. The directory
is a flat, platform-global list — the exact opposite of the mutual-aid feed's framing. A member
cannot tell which providers are *in their community* vs strangers from anywhere on the platform.

**Code confirmation:**
- `requests.provider_profiles` has **no community column** — schema comment: *"generic base
  table (publicly visible, not community-gated)"* ([init.sql:418](../../../infrastructure/postgres/init.sql#L418)).
- `GET /requests/providers` filters only `is_active` (+ optional `service_type`/`user_id`); **no
  `communities.members` join, no auth** ([providers.ts:11-55](../../../services/request-service/src/routes/providers.ts#L11-L55)).
- But the platform *already* knows a provider's communities: the availability endpoint derives
  `communityIds` from `req.user.communities` to fire `provider_went_on_duty`
  ([providers.ts:478-487](../../../services/request-service/src/routes/providers.ts#L478-L487)).
  → The implicit link (provider serves the communities they belong to) already exists; the
  directory just doesn't use it.

### 3. Become a provider (`/providers/new`) — **F2 (P2)**
**Screenshot:** `02-become-provider-onboarding.png`
Form: "Create your profile in the neighborhood service directory." Fields: Service type, Display
name, Bio, Pricing notes, **Location / service area** (free text, e.g. "North side of the city"),
"Profile is active (visible in directory)".

**Finding (H3):** The onboarding (a) frames the destination as a single global "directory", (b)
offers **no community selection** — you can't say which community/communities you serve, and (c)
never explains how being a provider relates to your communities, service requests, dibs, or
offers. Geography ("service area") stands in for community. A new provider has no mental model
of the community relationship.

### 4. Provider mode / dual identity — **F3 (P2/P3)**
The nav exposes an **"Off duty" / "On duty"** mode toggle once you have a provider profile. Your
provider identity also surfaces as: the "My Provider Presence" panel on `/providers`, the
"Become a provider" nav link, and Collectives. These are functional but scattered across
surfaces with no single coherent "you, as a provider, serving these communities" home.

**Finding (H2):** The member↔provider dual identity is real but fragmented; there's no one place
that ties "your provider self" to "your communities."

### 5. Service request → dibs → accept → review (transactional leg)
Not driven end-to-end live (a full two-account transaction would create demo data through
accept/review). The community-framing question on this leg is the **dibs prompt copy**, which is
already a pre-ratified fix:

**F4 (P1, pre-ratified — Task 5):** a neighbour admitted to the dibs candidate pool via an
exchange trust edge with **zero** completed matches is labelled `trusted_neighbor` → DibsPrompt
says *"You've worked with {name} before"* — which is false. Sprint 93 adds a `community_connection`
reason and honest copy ("You're connected with {name} in your community"). Verified in code at
`deriveDibsReason` (dibs.ts) and `dibsDb.ts:292-295`.

---

## Hypothesis results

| # | Hypothesis | Result | Evidence |
|---|-----------|--------|----------|
| H1 | No community–provider tie | **CONFIRMED** | Flat directory (screenshot 01) + no `community_id` column + no community join (providers.ts) vs richly-scoped mutual-aid feed |
| H2 | Dual-identity navigation incoherent | **CONFIRMED (mild)** | Mode toggle + My Provider Presence + nav link + collectives, no unified home |
| H3 | Onboarding clarity | **CONFIRMED** | Become-a-provider form: global-directory framing, no community selection, no relationship explanation (screenshot 02) |

No findings surfaced outside H1–H3.

---

## Severity-ranked fix list

| ID | Finding | Severity | Proposed fix | Effort | Schema change? |
|----|---------|----------|--------------|--------|----------------|
| **F1** | Provider directory has no community context | **P1** | Authenticated `GET /requests/providers` supports community scoping: join provider `user_id` → `communities.members` → viewer's community IDs; UI **groups/badges** "In your communities" vs "Other providers". Public unauth view unchanged. | **M** | No (uses existing memberships) |
| **F2** | Onboarding never explains community relationship | **P2** | Add community framing to `/providers/new`: a short explainer ("Your profile is visible to your communities") + (optional) surface which communities you'll appear in. | **S** | No |
| **F3** | Dual-identity surfaces scattered | **P2/P3** | Copy + light navigation polish so the provider self is presented coherently relative to communities (no structural rework). | **S–M** | No |
| **F4** | False "worked with before" dibs copy | **P1** | `community_connection` reason + honest copy. **Already pre-ratified (Task 5).** | **S** | No |

### Alternative (heavier) option for F1
Add an explicit `requests.provider_communities` listing table so a provider can serve communities
they are **not** a member of (vs the implicit "serves my own communities" MVP). More flexible,
but adds a migration + an onboarding multi-select + write paths. Not needed to fix the core
dissonance.

---

## Recommendation to the maintainer

**Ship the H1 MVP (F1) + onboarding copy (F2) this sprint; defer deeper H2 nav rework (F3).**

- F1 is the core dissonance and has a clean, schema-free implementation leveraging the implicit
  community link the platform already computes. Bounded effort, high payoff.
- F2 is cheap and reinforces F1 at the point of creation.
- F3 is real but mild; a copy/nav pass can ride along if time allows, full rework is its own sprint.
- F4 proceeds regardless (pre-ratified Task 5), as do the other two carry-forward bug fixes
  (members-DELETE JWT, login-401 crash).

The ratification checkpoint (next) records the maintainer's actual choice in the **Ratified
Scope** table above.
