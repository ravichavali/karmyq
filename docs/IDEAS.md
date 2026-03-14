# Karmyq Ideas & Open Questions

A running log of transient ideas captured mid-session. Use `/capture <idea>` to add entries.

---

## [2026-02-28] framing

"remembers" language should be reframed across trust/karma docs — shift from surveillance framing ("the system remembers your contributions") to meaning framing ("acts are ephemeral, their impact persists in the community"). Affects: trust-score.json, what-is-karma.json, platform-overview.json.

---

## [2026-02-28] framing

platform-overview.json has absolutist "not through money" framing that predates the service provider layer. Needs a dedicated session to soften it — acknowledge the two-layer model without undermining the mutual aid core message.

---

## [2026-02-28] skill-idea

A `/capture` skill (this one!) — drops ideas into a persistent scratchpad across conversations so nothing gets lost mid-task.

---

## [2026-03-01] open-question

Community trust score visibility — public to non-members or admin-only? (ADR-040 open question, not yet resolved.)

---

## [2026-03-04] architecture

Provider templates: `simulation/workflows/data.ts` has rich request templates (`title`, `description`, `urgency`, `type_payload`) via `pickRequest()`, but `registerAsProvider` uses small hardcoded arrays in `workflows/index.ts` (`PROVIDER_DISPLAY_NAMES`, `PROVIDER_BIOS`). Move provider seed data into `data.ts` as `PROVIDER_TEMPLATES` with richer fields: `service_type`, `display_name`, `bio`, `pricing_notes`, `location_notes`. Expose via a `pickProvider()` helper matching the `pickRequest()` pattern.

---

## [2026-03-04] open-question

Karma vs trust consistency: karma (reputation-service) and trust scores (social-graph-service) are two separate systems — separate APIs, separate score fields, no defined relationship. Need a design session: what's the conceptual difference? Does karma feed into trust? Should there be one unified "standing" concept? Affects ADR-011 (reputation decay), ADR-040 (community trust), platform-overview framing, and any future provider trust scoring.

---

## [2026-03-06] ux

Admin/moderator view of pending requests: admins should be able to browse all open/pending requests in their community so they can proactively identify needs and make connections between requesters and potential helpers. Useful for high-touch communities where admins play an active matchmaking role.

---

## [2026-03-06] architecture

Trust model evolution: Instead of abstract config numbers, express community trust model as answers to questions (e.g. "How do you feel about new members?" → infers karma_decay, trust_path_hops, visibility_mode). Admins can accept/reject system-proposed config evolutions over time as the community's actual behavior diverges from initial answers. Low-trust communities trend toward punitive karma (lower splits, deeper not wider trust paths); high-trust communities open up. Two features: (1) onboarding questionnaire that infers initial config params, (2) ongoing evolution proposals the admin can accept/reject based on observed community patterns.

---

## [2026-03-10] simulation

Sprint 20 simulation bugs observed in UI: (1) duplicate offers — same user appearing twice as responder on a single request; (2) no completions — requests stay open, neither side accepts; (3) community/user ratio imbalanced — too many communities relative to users, communities feel empty; (4) offer types — simulation likely not creating typed offers (ride, service, borrow, etc.) to match typed requests. All visible in the request detail view on karmyq.com. Fix before next demo.

---

## [2026-03-10] architecture

Default values for communities and users: need to define sensible initial config when a new community is created (trust model defaults, karma split defaults, member cap defaults) and seed data for trust/karma bootstrapping so new communities don't start empty. Related: what does a user's starting karma/trust look like when they first join?

---

## [2026-03-10] architecture

Individual trust mechanics: user-level trust scores need to be built out as a first-class system, separate from community trust score (ADR-040). Relates to the karma vs trust unification open question — are these one system or two? Needs a design session and possibly a new ADR. Touches ADR-011 (reputation decay), ADR-040 (community trust), and ADR-043 (three-score model).

---

## [2026-03-11] architecture

Sprint 23 must address GitHub security vulnerabilities at https://github.com/ravichavali/karmyq/security — 27 total (22 high, 3 moderate, 2 low). Dependabot alerts on the default branch. Resolve before next demo or investor review.

---

## [2026-03-12] ux

Admin/moderator > Requests tab needs to go beyond passive listing — admins should be able to *amplify* requests and *connect* people. Flesh out what this means: e.g. "boost" a request to surface it higher in member feeds, direct-message a specific member who has the skills to help, tag a request as urgent for the community, or propose a match themselves. The tab is now working (requests visible) but the interaction model is still read-only. Needs a design session to define the action set and what "admin-as-connector" looks like in practice.

---

## [2026-03-12] ux

Admin page simplification: the community admin page has 3 tabs for member management and 2 config areas that need consolidation. Too many surfaces for what should be a lightweight admin experience. Needs a design session to merge/streamline — likely: one unified "Members" tab (pending + active + roles), one "Settings" panel (collapsing trust config + community config into a single form).

---

## [2026-03-13] architecture

Liquid democracy seems to be an interesting idea for Karmyq — members could delegate their voting/governance weight to trusted others, who then vote on their behalf (transitively). Could apply to community decision-making, trust model evolution proposals, or admin actions requiring community consent. Explore fit with the existing trust path and karma systems.

---
