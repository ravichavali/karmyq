# Sprint 87-90: Product Polish Reset - Review and Roadmap

**Date**: 2026-06-05
**Status**: Proposed - awaiting maintainer approval
**Current version**: v10.10.0
**Recommended next branch**: `feature/sprint-87-product-truth-and-ux-reset`

---

## Maintainer Direction Added 2026-06-05

The presentation layer is not sacred. The next polish arc may change layout, navigation, visual
language, component hierarchy, card structure, page composition, and interaction patterns if that
better aligns the product with the manifesto. Existing UI abstractions are evidence, not constraints.

This changes the reset from "make the current shell nicer" to **manifesto-first presentation design**:

- **Community sovereignty should be felt before admin machinery.** Member pages should feel like
  places where a community lives, not databases with action buttons.
- **Meaning should outrank accounting.** The UI may keep scores where useful, but relationship
  reasons, commitments, stories, and consent should lead visually.
- **Privacy and forgetting should be visible.** Decay, fading, deletion, and non-broadcast reputation
  should become understandable UI, not hidden implementation details.
- **The help loop should feel finite and humane.** No engagement-feed chrome, no infinite-scroll
  posture, no busy dashboards that reward dwelling.
- **The visual system can be rebuilt.** Tokens, typography, spacing, page shells, cards, tabs, empty
  states, and copy are all in scope for redesign.

Recommended process implication: Sprint 87 should include visual research, reference comparison, and
throwaway mockups before implementation planning. The implementation plan should be written only after
the maintainer approves the new presentation direction.

---

## Decisions Locked (2026-06-05, maintainer)

These resolve the Open Questions at the end of this doc plus a finding raised in review:

1. **Aesthetic anchor = "warm commons, calm behavior."** Warmth is the *identity* (people, faces,
   stories, relationship reasons lead; humane voice); calm is the *discipline* (finite queues, no
   engagement chrome, quiet density, visible privacy/decay). Reference feel: a well-made neighborhood
   library / thoughtful newsletter — **not** a cold SaaS dashboard, **not** a loud civic-tech poster.
   Sprint 87 visual research keys off this. (Resolves Open Q2.)
2. **Sprint 87 includes quick wins** (low-risk, unambiguous): stale version/source-of-truth metadata,
   `apps/frontend/CONTEXT.md` BrowseFeed drift, landing placeholder stories. Design research + throwaway
   mockups remain the core; **no production UI rewrite until the direction is approved.** (Resolves Open Q1.)
3. **Score-vs-relationship taxonomy** — a design rule for the whole arc, on every member-facing surface:
   - **Lead with the relationship path** (degree of separation / "via X") — manifesto-endorsed *meaning*.
   - **Remove per-person reputation/trust SCORES** (karma points, trust-score stars).
   - **De-emphasize the match-relevance %.**
   Concretely, the `RequestCard` `KarmaBadge` (⭐points + trust-score stars) is a manifesto violation;
   **fold its removal into the Sprint 88 card redesign** (decide the card holistically) — keep
   `TrustPathBadge`. (Resolves the review's karma-on-tiles finding.)
4. **Community feed "show all open" = both:** curated-first default (`minScore≥30`), a low-altitude
   member "show more open requests" affordance, **and** the admin all-status management list (shipped
   #64). Never an always-on firehose. Implements in Sprint 88. (Resolves Open Q3.)
5. **"Designed to forget" stays Sprint 90** (the full member-facing memory/forgetting surface), but
   **seed a small "what fades" affordance in Sprint 88** so the promise appears early, not only in docs.
   (Resolves Open Q4.)

**Added Sprint 87 scope from this review:**
- **Clean/seed representative demo data before the screenshot UX audit** — stale sim data makes the audit
  judge noise (see `docs/IDEAS.md`). The audit is only as honest as the data behind it.
- **Accessibility + responsive** are explicit rules in the new presentation system, not just tokens/
  type/spacing.

**Process note (multi-agent):** Codex and Claude are both working this arc. Assign one owner per lane per
sprint, **commit WIP promptly** (the roadmap + handoff sat uncommitted and were nearly lost to a
`reset --hard`), and don't both edit the same doc concurrently.

---

## Executive Summary

Karmyq has the right philosophical spine, and the recent unified-feed work moved the product in the
right direction. The drift is now less about missing features and more about whether the product
surface makes the founding promises legible:

- Karmyq says it is infrastructure for community experiments, but the app often feels like a generic
  dashboard with admin panels attached.
- Karmyq says meaning matters more than accounting, but several surfaces still foreground points,
  scores, percentages, and "stay engaged" language.
- Karmyq says trust fades and privacy is default, but the forgetting/decay promise is mostly invisible
  outside ranking math and docs.
- Karmyq says one feed, two views, but mobile, service docs, and some context docs still describe old
  feed paths or build their own feed model.
- Karmyq says real communities and stories, but the public site still has placeholder story content
  and public docs metadata appears behind the repo state.

Recommended move: pause net-new product expansion for two polish sprints. Do not start with mobile
parity or analytics as the lead sprint. First align the product truth, visual language, and core web
experience, then carry that clarified model to mobile. Treat current presentation patterns as
replaceable when they conflict with the manifesto.

---

## Sources Reviewed

### Public philosophy and docs

- `https://karmyq.org/` - manifesto/landing framing: community experiments, no extraction, meaning
  over points, privacy by default, trust that fades.
- `https://karmyq.org/docs/` - public docs surface. Live search currently surfaces older docs metadata
  and did not surface the newest unified-feed guide/concept pages during this review.
- `https://karmyq.org/docs/concepts/trust-score/` - trust is relational, local, and decays.
- `https://karmyq.org/docs/concepts/adr-048-feed-ranking-v2/` - feed ranking and impression logging
  intent.

### Local repo context

- `.claude/handoff/CURRENT_HANDOFF.md` - Sprint 86 shipped, Sprint 87 nominally mobile parity,
  impression logging, and `minScore` community-view decision.
- `docs/design/sprint-84-unified-feed/README.md` - finite actionable queue direction.
- `docs/concepts/ux-design-principles.md` - five core flows and "one screen, one job".
- `apps/frontend/CONTEXT.md` - contains fresh S86 notes but still documents removed `BrowseFeed`
  architecture from Sprint 34.
- `apps/frontend/src/components/Feed/*` - current unified feed, canonical request card, decision band.
- `apps/frontend/src/pages/communities/[id].tsx` and `components/community/tabs/*` - community IA,
  request/admin management, fission/fusion/governance surfaces.
- `apps/mobile/app/(tabs)/feed.tsx` and `apps/mobile/services/api.ts` - mobile still builds a local
  feed from raw request/match calls rather than the unified feed contract.
- `services/registry.json` - `feed-service`, `cleanup-service`, and `geocoding-service` remain marked
  as consolidation/removal candidates.

---

## High-Signal Findings

### 1. Source-of-truth drift is visible to agents and users

Root and docs metadata are stale in ways that can mislead both people and agents:

- `package.json` is v10.10.0, but `CLAUDE.md`, `README.md`, `docs/README.md`, and
  `docs/ARCHITECTURE.md` still carry much older version/update metadata.
- `apps/frontend/CONTEXT.md` still presents `BrowseFeed` as a live dashboard component even though
  Sprint 86 retired the legacy feed components.
- Landing docs build metadata is behind the handoff/version state, and public search did not find the
  newest unified-feed docs during this review.

Impact: every future sprint starts with slight confusion. This is product debt, not just docs debt,
because Karmyq's public docs are part of the promise.

### 2. The unified feed is directionally right but still reads too much like a scored feed

The architecture now supports one feed model and action altitude. The visible card still puts a bare
percentage and compact badges near the top, while the "why this matters" relationship explanation is
compressed into a small line.

The founding promise is "trust through relationships", not "algorithmic relevance score". The feed
should visually lead with relationship reason, task clarity, time/scope, and next action. The score can
exist, but it should not be the primary emotional signal.

### 3. Community pages violate "one screen, one job"

The community detail page has up to ten tab concepts: overview, people, activities, requests,
providers, trust graph, governance, settings, split, fusion. The Requests tab is improved for members
but still carries admin stats, all-status management, trust score panels, network cohesion panels, and
export tools.

Impact: the community experience feels like an admin console that members are allowed to visit, not a
living community space with governance available when relevant.

### 4. Governance, split, and fusion are powerful but visually raw

The fission/fusion surfaces use raw blue/gray Tailwind styling and technical language such as target
community UUIDs, algorithmic grouping, quorum percentages, assignment tables, and execute buttons.
These are accurate, but the UX does not yet express community sovereignty, consent, or trust-informed
change. It feels like operating machinery.

### 5. "Meaning, not accounting" is undercut by profile and reputation copy

Profile still includes language such as "Karma Points", "Keep helping others to maintain and grow your
score", and "stay engaged". That pulls the product back toward gamification even though the public
manifesto explicitly rejects accounting and permanent scorekeeping.

Recommended shift: show recent contribution, living trust, privacy posture, and what fades. Avoid
nudging people to optimize a score.

### 6. "Designed to forget" is not yet a felt product promise

The platform has real decay mechanics: decayed trust edges, request TTL sweeps, reputation decay docs,
and ADRs. Users mostly cannot see what is remembered, what fades, and when. The product needs a
member-facing memory/forgetting surface before adding more features that depend on trust.

### 7. Mobile parity is important but should not copy stale web UX

Mobile currently builds a feed locally from raw requests/matches and older API helpers. It does not
consume the unified feed item union, decision band, community texture, or current match-score/status
vocabulary. If mobile parity starts before web polish, it will preserve current drift in a second app.

### 8. Architecture pruning is still unfinished

`feed-service` remains in docs/registry even though ADR-066/S86 made request-service the feed source of
truth. `cleanup-service` and `geocoding-service` are still marked as candidates for replacement/removal.
This is not the first polish sprint, but it should be scheduled soon so the system matches the story.

---

## Recommended Multi-Sprint Arc

### Sprint 87 - Manifesto-First Presentation Reset

**Goal:** establish the product's new presentation direction from the manifesto before adding more
surface area or copying the current web shell to mobile.

**Primary deliverables:**

- Update stale source-of-truth docs: `CLAUDE.md`, `README.md`, `docs/README.md`,
  `docs/ARCHITECTURE.md`, `apps/frontend/CONTEXT.md`, and affected landing docs metadata.
- Replace public landing placeholder stories or remove the story cards until real/founding-circle
  stories exist.
- Create a concise product-polish scorecard with the core promises:
  community sovereignty, help loop clarity, privacy/forgetting, meaning-not-points, local trust.
- Research visual references for a calm, trust-centered operational product: quiet density, editorial
  warmth where appropriate, no engagement-feed posture, no generic SaaS chrome.
- Produce screenshot-based UX audit notes for Dashboard Home, Request Wizard, Community page,
  Profile/Reputation, Governance, Fission/Fusion, and mobile Feed.
- Produce throwaway mockups for the key surfaces: Dashboard Home, Community Home, Request Card,
  Profile/Trust, and Governance/Fission/Fusion.
- Define the new presentation rules: page shells, type scale, spacing, color use, card hierarchy,
  status language, score treatment, privacy/decay affordances, and mobile translation.
- Decide the community feed `minScore` behavior: recommended default is "curated first" plus a
  low-altitude "show more open requests" affordance, not an always-on social-style firehose.
- Confirm whether Sprint 88 implements Dashboard Home first or a shared design-system shell first.
  Recommendation: shared shell + Dashboard Home together, because the help loop is the proof point
  for the new presentation language.

**Not doing:**

- No production UI rewrite until the visual direction is approved.
- No mobile parity implementation yet.
- No service consolidation yet.

**Validation:**

- Repo docs metadata agrees with v10.10.0 and Sprint 86 state.
- Public docs generation is verified locally and deployment freshness is checked.
- At least one human walkthrough session against demo captures UX notes per surface.
- Maintainer reviews and approves the mockup direction before the implementation plan is written.

### Sprint 88 - Core Help Loop Redesign

**Goal:** implement the approved presentation direction on the ask/offer/follow-through loop, making
it calm, finite, and relationship-led.

**Scope:**

- Rework `RequestCard` visual hierarchy: relationship reason and task clarity above percentage.
- Redesign the Dashboard Home shell if needed; current tab/card layout is not mandatory.
- Add/strengthen "why this is here" explanations: trust path, shared community, skill/type fit,
  recency, urgency.
- Polish the finite queue states: caught-up, no matching requests, filter-empty, and community-empty.
- Resolve community feed `minScore` with an explicit "show more" or "all open" state if approved.
- Add impression logging for `view=home` and `view=community` unified-feed paths.
- Polish `RequestWizard` copy and controls so it gathers commitment-legible asks, not generic tickets.
- Update onboarding and user guides to match the polished loop.

**Success criteria:**

- A new member can understand "who needs me, why me, what commitment is involved, and what happens
  after I offer" without reading docs.
- The score is explainable and secondary; the relationship reason is primary.
- Unit/regression tests cover feed logging, request card states, and wizard copy/control behavior.

### Sprint 89 - Community Sovereignty Redesign

**Goal:** make community pages feel like living community spaces first, admin consoles second.

**Scope:**

- Split member-facing community home from admin management altitude.
- Redesign community page IA if needed; current tabs are not sacred.
- Reframe tabs around member jobs: Home, People, Requests, Activities, Trust, Governance. Hide or
  conditionally surface split/fusion only when relevant.
- Move admin request stats/export/triage/boost/propose-match into an explicit Admin area, not the
  member Requests flow.
- Polish Community Home to show norms, current needs, activity pulse, trust health, and upcoming
  governance decisions without making it a metrics dashboard.
- Convert raw fission/fusion UI styling to canonical Karmyq tokens and progressive staged cards.
- Replace target-community UUID entry with a searchable/validated community picker.

**Success criteria:**

- A regular member sees the community's life and next meaningful actions before admin machinery.
- An admin can still manage requests and community evolution efficiently, but those controls no longer
  dominate the member experience.

### Sprint 90 - Trust, Forgetting, and Profile Polish

**Goal:** make "meaning, not accounting" and "designed to forget" visible in the member experience.

**Scope:**

- Rewrite Profile/Karma/Reputation copy away from points optimization and toward contribution history,
  living trust, privacy, and recency.
- Add a "what fades" or "memory" explanation surface: what the platform remembers, what decays, what
  is deleted, and what remains private.
- Show trust decay in a legible way on graph/profile surfaces: recent, fading, and gone.
- Review invite stats and "gamification metrics" language for manifesto alignment.
- Update trust/karma docs and onboarding.

**Success criteria:**

- A user can explain why trust fades and what data is or is not retained.
- The profile no longer encourages score-chasing as a product goal.

### Sprint 91 - Mobile Parity from the Polished Model

**Goal:** bring mobile onto the unified feed and polished help loop after the web model is stable.

**Scope:**

- Replace the mobile locally composed feed with the unified feed contract.
- Add mobile equivalents for decision band, canonical request card, community texture, and caught-up
  states.
- Align mobile request detail and Asks/Helping vocabulary with web.
- Add missing mobile context docs and tests.

**Success criteria:**

- Mobile and web consume the same feed semantics and differ only in layout.
- No raw legacy request/match composition remains in the mobile primary feed.

### Sprint 92 - Architecture and Service Pruning

**Goal:** make the implementation topology match the simplified product story.

**Scope:**

- Run the formal architecture review checklist.
- Decide and execute feed-service retirement or archival path if request-service remains source of
  truth.
- Decide cleanup-service replacement boundary: what remains cron-worthy versus pg_cron.
- Revisit geocoding-service removal candidate.
- Update service registry and landing service docs so candidates are clearly marked or removed.

**Success criteria:**

- Service docs no longer advertise stale ownership.
- The active service list is understandable to a new contributor in one pass.

---

## Recommended Next Sprint Choice

Pick **Sprint 87: Product Truth and UX Reset** as the next sprint, even though the handoff previously
queued mobile parity. Mobile parity should follow the clarified web model, not fossilize the current
one.

The key decision for the maintainer:

> Should Sprint 87 be a pure review/spec/no-deploy sprint, or should it include quick-win doc and
> landing-page fixes?

Recommendation: include quick wins. The stale metadata, frontend context drift, and placeholder
landing stories are low-risk fixes that immediately reduce confusion while the deeper UX plan is
being finalized.

---

## Open Questions for Approval — ✅ RESOLVED 2026-06-05

All four are answered in **Decisions Locked** (top of this doc):

1. ~~Quick-win fixes vs `no-deploy`?~~ → **Include quick wins** (Decision 2).
2. ~~"Claude-like calm" vs cooperative/community aesthetic?~~ → **Warm commons, calm behavior** (Decision 1).
3. ~~"show all open requests" member / admin / both?~~ → **Both** (Decision 4).
4. ~~"Designed to forget" Sprint 90 or earlier?~~ → **Sprint 90, seeded in Sprint 88** (Decision 5).
