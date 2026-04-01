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

## [2026-03-18] architecture

**Future sprint: Improve social graph naturalness**

The network graph looks unnatural — one early user (Maria) is hyperconnected while newer users form an isolated disconnected cluster. Root cause: social connections are only created on fully completed matches (both parties mark done, ~50% chance each). Early users had a head start accumulating completed matches; new users who haven't completed matches yet have zero connections.

Proposed improvements:
1. Create a connection on match *acceptance* (not just completion) — reduces the two-gate problem
2. Create weak connections for community co-membership — users in the same community should have some graph relationship even without direct interaction
3. Simulation profile rebalancing — too many BROWSER profiles (passive) who never create requests, making them invisible in the graph
4. No accept-offer workflow in simulation — offers from one session are never accepted because the requester may not be active in the same session window

Also related: simulation was stuck creating communities because of `access_type: 'open'` vs `'public'` mismatch (fixed 2026-03-18). Once new communities are created, users will spread across more communities and the graph will naturally diversify.

---

## [2026-03-25] architecture

We probably need to work on creating communities that are for group activities as well — not just mutual aid between individuals, but communities organized around shared events or recurring group actions.

---

## [2026-03-26] architecture

Provider listing page may not be the right model — Karmyq is request-driven, not supplier-driven. Not sold on a browsable provider directory.

---

## [2026-03-26] architecture

Direct provider request = "dibs" model: request is sent privately to one specific person first. If they reject (or don't respond), it becomes public and broadcasts to available providers. Preserves trust-based priority while keeping the network as fallback.

---

## [2026-03-26] architecture

Group task communities — sports teams, fitness groups, hobby clubs — should be a distinct community type organized around shared recurring activities, not just mutual aid between individuals. Plan before onboarding/first-run UX sprints.

---

## [2026-03-26] other

Look at other areas of day-to-day services that are high friction and see if the platform can help smooth them out — e.g. what makes people avoid asking for help or hiring locally? Where do trust gaps or coordination overhead cause people to default to impersonal alternatives?

---

## [2026-03-26] architecture

Provider availability toggle should work like a cab driver going on/off duty:
- Toggle ON → provider starts seeing relevant community requests in their feed
- Provider responds to a specific request with their price (per-request, not just rate card)
- Both sides can check trust scores before committing
- On/off distinction matters because provider interactions are more time-sensitive than general help requests
- Model: need is posted → available providers come to it (reverse marketplace), not "browse providers and hire one"

Open questions: do rate cards become per-request defaults? Feed vs. push notification for new requests? Acceptance flow shape?

---

## [2026-03-30] other

Pre-existing TypeScript warnings cleanup — during Sprint 42 we saw recurring ✶ warnings in files we touched but didn't introduce: unused `data` params in notificationTemplates.ts, unused `feedComposer` import in feed.ts, unused `userBehavior` in feedComposer.ts, unused `res`/`error` params in cleanup-service middleware helpers, unused `match` implicit any in generate-docs.ts. These are harmless but noisy. Proposal: dedicate one small task per sprint to clean 3-5 of these (fix `_`-prefix unused params, type the implicit any). Low-effort, keeps the codebase tidy, improves signal-to-noise in the IDE diagnostic panel.

---

## [2026-03-31] open-question

Should service requests (paid provider requests) be community-scoped or platform-scoped? Currently they follow mutual aid requests into a community, which roots trust scoring and dibs candidate selection in community membership. The alternative: service requests are platform-wide, but trust scores and prior interactions still influence provider ranking/dibs. The dibs model already hints at platform-scoped (requester picks a specific trusted person regardless of community overlap), but the current `getEligibleCandidates` query still requires community context. Needs a design session before the provider experience sprint. Affects: dibs candidate selection, provider directory model, trust score scoping, and the open question of whether a provider's reputation travels across communities.

---

---
