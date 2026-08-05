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

## [2026-04-01] architecture

Process improvement: we keep finding bugs through manual testing that could be caught earlier with better error infrastructure. Sprint idea: (1) structured error logging with context (service, endpoint, user, payload) sent to a log aggregator or error tracker (Sentry/Datadog/Axiom free tier), (2) frontend error boundaries that show friendly messages AND log to the tracker, (3) a convention for distinguishing user-facing 400 errors (show the message verbatim) from unexpected 500s (show "something went wrong, ref: [request-id]"). Currently errors like missing title, wrong urgency value, and wrong schema name all silently surface as generic messages. Concrete steps: wire up Axiom or Sentry across all services + frontend, add a global error boundary in Next.js `_app.tsx`, and standardize the error response shape to include a `type: 'user_error' | 'system_error'` discriminator.

---

## [2026-04-02] ux

Feed improvement: a confirmed match should be considered as a commitment for both the requestor and the helper. Currently a match may appear in the feed as an open request even after it's been accepted. Both parties should see it reflected in CommitmentsTab once a match is confirmed, and it should no longer surface in the browse feed as available.

---

## [2026-04-02] ux

**Ongoing**: The UI needs to be continuously simplified — not a single sprint, but a lens applied to every sprint. Each sprint should ask: what can we remove, consolidate, or make less noisy? Priority areas to watch: tab count, card density in CommitmentsTab, provider mode switcher discoverability, and the dashboard header area.

---

## [2026-05-06] ux

Community and provider are 2 facets of the same user — not separate modes. A provider should be able to browse the community user dashboard and act as a community member without switching contexts.

---

## [2026-05-06] ux

Provider and community facets should have different color patterns — visual language that signals which context you're operating in without requiring a mode toggle.

---

## [2026-05-17] framing

Make sure that simplicity is the default. When in doubt, do less — simpler code, simpler abstractions, simpler flows. Complexity should require justification; simplicity should not.

---

## [2026-05-19] architecture

**Community fission — two models (both still ideas)**

*Split (mitosis):* Triggered at ~Dunbar ±10. Full trust inheritance. Groups formed by interaction density clustering, random tiebreaker for ambiguous cases. Requires collective decision by moderators/admins. Daughter communities should start with a high cross-community prior with each other — they share history.

*Small group fission (pioneering):* A subset breaks off. Partial trust inheritance only. Two distinct motivations need different mechanics: deliberate offshoot vs. schism. Nothing designed yet.

---

## [2026-05-19] architecture

**Governance model**

- Founder group: 5–6 people, initialized at community creation, handles moderation/admin/governance.
- No permanent roles: roles reflect current trust, not historical status. Power flows toward demonstrated trustworthiness over time.
- Governance as a function of trust: governance rights expand as community trust matures. Prevents bad actors from creating a community and immediately setting harmful norms.
- Templates: communities can start from scratch or from templates. Questionnaire matching finds similar communities and suggests their governance models — cultural transmission by design.

---

## [2026-05-19] framing

**Macro argument — hold for later (do not add to site yet)**

Every major technological shift follows a consolidation → diffusion arc. Current warning flags — oligarchy, low engagement, populism, inequality — are all symptoms of captured trust and hollowed community. Karmyq as infrastructure for the diffusion phase.

Hold until: governance layer is built, federation exists, third-level fractal has real mechanics behind it.

---

## [2026-05-19] architecture

**Anti-oligarchy as architectural principle**

Non-permanent roles are the community-level answer to entrenchment. Eligibility gated by trust score, ratified by community. Roles are a reflection of current trust, not a reward for past trust.

---

## [2026-05-19] other

**Blog on karmyq.org — testimonials and stories**

Add a blog to the landing site where community members can post testimonials and stories. Needs: governance on who can publish (e.g. community trust threshold, admin nomination), an editorial process (draft → review → publish), and a content model. Good surface for social proof and mission framing.

---

## [2026-05-20] ux

**Browse feed filter in On-duty mode (Sprint 61 candidate)**

Sprint 60 forks Browse by provider availability but the on-duty experience is too blunt — it only shows provider-matched requests. Better model:

- **Off-duty**: community feed, no controls (current behavior)
- **On-duty**: 3-chip segmented control above the feed — **Community / Provider / Both**
  - *Community* → normal unfiltered community feed
  - *Provider* → filtered by provider service types (current on-duty behavior)
  - *Both* → unfiltered, but provider-type requests get a visual callout

State: persist choice in `localStorage` keyed to provider mode. Default for on-duty → *Provider*.

**Color coding for request origin:**
Cards in the feed should have a subtle visual signal to distinguish request type, especially in *Both* mode:
- Provider requests (matching provider service types) → amber/orange left-border accent
- Community requests → existing primary/green accent

Color is derived client-side from `request_type` — no backend change. Could also use a small "Provider match" badge on the card rather than (or in addition to) the border.

Files to change: `apps/frontend/src/components/BrowseFeed.tsx`, `apps/frontend/src/pages/dashboard.tsx` (pass `browseMode` state down).

---

## [2026-05-20] other

Bug: clicking "Withdraw Offer" on the Active tab returns "Only the requester can reject this match." The withdraw action is calling the wrong endpoint or passing the wrong role — the responder (helper) should be able to withdraw their own proposed offer, but the rejection guard is treating it as a requester-only action.

> **Resolved — record-keeping only (verified 2026-06-15, Sprint 100 planning).** The reject/withdraw
> guard at `services/request-service/src/routes/matches.ts:448-453` now permits **either match
> participant** (requester *or* responder); the old requester-only string "Only the requester can
> reject this match" no longer exists anywhere in the codebase (current message: "Only match
> participants can reject or withdraw."). A responder can withdraw their own proposed offer. Fixed in
> the Sprint 85/92 match-lifecycle work; this entry was just never annotated. No further action.

---

## [2026-05-20] framing

Feeds and dashboards need to be designed fit-for-purpose. These are not Facebook-style infinite feeds — they don't have to keep scrolling forever, and curation probably matters more than volume. Need to start from what the platform is actually trying to do (connect people who need help with people who can give it, within a community of trust) and design the feed/dashboard experience backwards from that goal — not borrow patterns from social media.

> **Addressed by Sprint 84** (2026-06-03): turned into a design direction — see
> [`docs/design/sprint-84-unified-feed/README.md`](design/sprint-84-unified-feed/README.md). Sprint
> 85 implements the unified feed (Dashboard Home first). The Withdraw-Offer role bug in the
> [2026-05-20] "other" note above is carried to Sprint 85 (§7.4).

---

## [2026-05-24] architecture

Data cleanup should be a priority in coming weeks — stale simulation data, orphaned records, and test state are accumulating on the demo server and making the platform harder to evaluate clearly.

---

## [2026-06-04] framing

We need to deliver the "platform forgets" claim in a serious way soon. The "designed to forget" / trust-atrophy promise (manifesto §7, ADR-066) is currently only *structurally enforced in feed ranking* via the decayed trust-edge weight (`trust_edges_live.current_weight`) — that's ranking math, not a visible, trustworthy promise. To honor the claim we need real forgetting members can see and feel: actual data retention/forgetting policy (what's deleted/decayed and when), visible decay in the UI (a relationship/trust edge perceptibly fading over time), and possibly user-facing controls or transparency about what the platform remembers vs. lets go. Not just an invisible exponential in the sort key.

---

## [2026-06-07] ux

The landing page on karmyq.org can have an analytics section that shows the trends that helps tell the story. This is for development in the far future.

---

## [2026-06-08] ux

Community / service-provider link-up seems confusing. We need to clean it up.

---

## [2026-06-09] architecture

**Dibs candidate as server-side relationship routing (not a UI hint).** `GET /requests/:id/dibs-candidate` should treat first-ask as relationship routing that *strengthens existing bonds*: route similar future asks toward someone the requester has successfully interacted with before. Sprint 92 (PR #77) shipped the correctness floor — derive provider-vs-neighbour `kind` from the **persisted** `request_type` (ignore `?type=`), matching `POST /dibs` rules so client can't influence the pool. The next step is to return the server's *judgment*, not just a pool result:

```
candidate: {
  userId,
  kind: 'neighbor' | 'provider',
  reason: 'prior_similar_success' | 'trusted_neighbor' | 'provider_match',
  relationshipContext: { priorCompletedMatches, lastInteractionAt, similarCategory }
}
```

Server rules: what kind of request is this? who has helped this requester before? was the prior interaction completed/successful? is the task similar enough (category)? still eligible/active/trusted/in-community? frame as "ask this neighbour first" vs "book this provider again". UI then renders the server's reason ("You've worked with Maya on something similar — ask them first?") instead of recreating the logic. Scope: response-contract change + DibsPrompt copy rework + tests + ADR-072 update. Candidate for the next sprint.

---

## [2026-06-10] architecture

**Shared `sendError` envelope violates the CLAUDE.md `error: "CODE"` string contract.**
`packages/shared/utils/response.ts` `sendError` emits `error: { code, message }` (an OBJECT),
while CLAUDE.md's API contract specifies `error: "ERROR_CODE"` (a string). Rendering that object
directly into JSX throws React #31 ("Objects are not valid as a React child") → the whole-app
ErrorBoundary (the Sprint 93 login-401 crash). Sprint 93 defended the **read** side only —
`api.ts` interceptor now coerces `data.error` to a string, and a shared `getErrorMessage` helper
(`apps/frontend/src/lib/errors.ts`) guards the five JSX-bound page sites — but did NOT change
`sendError`'s shape, because every backend consumer depends on it (flipping it is a cross-service
migration). Follow-up: pick the canonical error contract (string `error` code + separate
`message` field, or keep the object and update CLAUDE.md), then migrate every service + client
consistently. Touches all services' error responses and the frontend error-handling paths.

> **Addressed by Sprint 94 / ADR-074 (2026-06-11):** canonical contract is
> `{ success:false, message:string, error:string }`; shared helpers and shared middleware now emit
> the string-code shape. Direct route literals remain documented drift rather than a full sweep.

## [2026-06-15] architecture

Sprint 100 candidate: increase simulation pace / data growth so test users fill out with good,
lively data. Maria has rich depth (15 communities, providers, trust) but her dashboard Home reads
empty — root cause: ~335 `proposed` responder matches (103/week) that don't surface as actionable
items on Home (they sit in `proposed` state). The sim is very active platform-wide (1019 open
requests, 3543 matches in 2 days), but that activity isn't translating into responder-facing Home
activity for established users. Two threads:
(1) raise sim pace + spread fresh requests across more test users so multiple demo accounts look
lively;
(2) investigate whether `proposed` matches should surface on responder Home/Helping (possible
feed/surfacing gap, bigger than the Sprint 99 frozen scope). See
`docs/bugs/sprint-99-release-experience-audit.md`.

---

## [2026-06-24] ux

Belonging graphs are too buried — they should be more front-and-center, not tucked into a profile section / dashboard widget / community sub-tab. The graph is "the primary way Karmyq tells a member's story" (ADR-081), so its placement should match that altitude. Possible directions: a top-level nav entry for `/network`, surfacing the belonging graph higher on the dashboard/home, or an onboarding moment that shows a new member their (growing) network. Follow-up to S111, which built the engine + explorer but kept the entry points modest.

---

## [2026-06-25] design

Community tab: "My Network" and "Community" views do almost the same thing — overlapping purpose/content. Rethink what each is for before/while building S112 PR B (My Network prominence). Candidate split: My Network = the member's personal belonging graph + relationships (ego-centric); Community = the community-wide aggregate/health/steward view (group-centric). Clarify the distinction so the two don't duplicate, and make navigation reflect it.

> **Planned — Sprint 113 PR B (2026-06-25).** Resolved via the **fractal metaphor**: the two views are
> two zoom levels of one structure, not duplicates — *My Network* = ego scale (you + your people/
> communities, travels with the member); *"How we're connected"* = the level up, communities-as-nodes at
> the community/group scale. PR B makes the distinction legible in nav, labels, and entry points. See
> `docs/superpowers/specs/2026-06-25-sprint-113-belonging-truth-prominence-design.md`.

---

## [2026-07-08] infra

Regenerate `infrastructure/postgres/init.sql` from a fully-migrated schema so there is ONE seed path everywhere. Today init.sql is a drifted fresh-install snapshot: it lags the 64-migration chain (missing federation/governance/ui_schemas, `chk_help_requests_status`, `trust_decay_config`, `trust_edges.stability`, ...), which is why CI needed `scripts/ci-apply-full-schema.sh` (PR #143) — an explicitly-acknowledged CI-only convergence workaround, not the root-cause fix. The fix-forward move: `pg_dump --schema-only` against a DB that has had `scripts/apply-migrations.sh` run to completion, then reconcile RLS/ownership statements and init.sql's hand-written comments/seed data. Higher-risk task (touches every fresh-install path: local docker-compose, CI, any new env) — deserves its own sprint/PR with the CI full-schema job as its safety net. Until then, every new migration that CI must catch may need a sentinel added to ci-apply-full-schema.sh. Related smaller follow-up: demo never receives edits made to already-tracked migration files (apply-migrations.sh skips them) — the uq_*_global guard indexes from PR #143 exist only in CI/fresh installs; verify demo's `auth.generate_invitation_code` is the REGEXP_REPLACE version (it should be, via 009's original run) and ship a small NEW convergence migration if any of this is ever needed live.

> **Addressed by ADR-087 / PR #153 (Sprint 120 PR B, 2026-07-21).** `init.sql` is now the generated
> product of the migration chain (`scripts/regenerate-init-sql.sh`), seeded with `public.schema_migrations`
> so fresh installs don't replay; a real `--drift-check` mode in `scripts/ci-apply-full-schema.sh` +
> a promoted regression gate guard against future drift. See ADR-087.

---

## [2026-07-22] ux

**Deferred structural findings from the Sprint 120 PR C five-second audit**
(`docs/superpowers/research/2026-07-16-sprint-120-five-second-audit.md`; the audit's quick wins
R-1…R-8 shipped in PR C at v11.32.0).

- **R-9 — raise content above the fold.** On `/dashboard` at 1440 the first actual ask starts at
  ~60% of the viewport height; at 375px it is entirely below the fold. Everything above it is
  chrome, greeting, lede, and the "My Network / Explore →" promo card. Reference products (Nextdoor,
  Buy Nothing) put evidence first and explanation second. Fix shape: collapse the greeting/lede block
  and demote the promo below the first two asks. Deferred because it re-opens the S119 hierarchy work
  and deserves its own design pass.
- **R-10 — a real first-run path for a sparse member.** A degree-1 member sees the same "led by the
  relationships that make help possible" lede, the same feed shape, and the same promo as a rich
  member. PR C's R-7 adds a prompt on `/network`; the deeper answer is a guided "get your first
  connection" flow. Note the demo's own trust graph is sparse — 19 users sit at degree 1 and the
  designated "rich" persona `maria.reyes` has only 4 connections.
- **R-12 — graph label legibility at 375px.** Node labels on `/network` are pale grey on cream and
  "Maria Reyes"/"James Okafor" visually collide at mobile width. Deferred because label styling sits
  inside the pinned S115/S118/S119 visual-encoding contracts and needs regression pinning first.

Also unaudited this pass and worth a future five-second run: request detail, the create-request
wizard, community detail + steward tabs, profile, notifications, the messaging thread, and the
md→lg topbar rhythm.

---

## [2026-08-03] deps

**The "platform floor" arc — Sprint 123 candidate.** Sprint 122 PR 3 closed three Dependabot
majors with written rationale and **no ignore rule**, because each is a floor-raise that the
others depend on rather than a bump that can land alone. They must go in dependency order:

1. **Runtime floor off `node:18-alpine`.** Every service Dockerfile still builds on Node 18, which
   is EOL. Nothing above can be adopted honestly until the runtime moves — @types/node 26 and
   TypeScript 7 both describe a runtime we do not run.
2. **`@types/node` 20 → 26** (#171). Purely a types bump, but it asserts Node 26 APIs exist; it is
   a lie about the container until step 1 lands.
3. **TypeScript 5.9 → 7** (#168). TS 7 is the Go port (`tsgo`). Blast radius is every workspace's
   `tsc --noEmit`, plus `ts-jest`, which currently sits pinned at 29.4.6 (see below).
4. **ESLint 9 → 10** (#170). Sprint 121 PR 3 just migrated to flat config, so the structural work
   is already done; 10 mainly drops old Node and removes deprecated APIs. Cheapest of the four,
   but sequenced last because its parser follows TypeScript.

**~~Carry-forward blocker~~ — RESOLVED in Sprint 122 PR 4 (v11.39.0, ADR-089).** `ts-jest` is no
longer pinned; the root override is deleted and every workspace declares `^29.4.12`.

⚠️ **The root cause recorded here by PR 3 was WRONG, and so was its premise.** It blamed the root
`jest.config.js` supplying an **inline `tsconfig` object**, and proposed pointing ts-jest at each
workspace's real `tsconfig.json`. PR 4 tested both claims:

- With the real tsconfig path in place, ts-jest 29.4.12 **still** failed with the identical
  `TS2307`; with `typesVersions` added and the inline object deliberately restored, it passed.
- An inline object does **not** stop ts-jest 29.4.11+ reading `tsconfig.json`. Measured on 29.4.12:
  it still resolves `apps/landing/tsconfig.json` and inherits `strict`, `target` and
  `isolatedModules`, exactly as the path form does — it merges the inline keys on top.

**Actual cause:** ts-jest forces `moduleResolution: node10` whenever it forces `module: commonjs`
— in *every* 29.x, 29.4.6 included — and `node10` does not read `exports` maps. No tsconfig can
avoid it (`node16` and `bundler` are both substituted to `node10` alongside `module: commonjs`).
The fix is **`typesVersions` in `packages/shared/package.json`**, generated from the `exports` map
and held identical to it by a blocking test. See
[ADR-089](adr/ADR-089-ts-jest-subpath-type-resolution.md).

PR 4 initially made the inline-object-to-path change anyway, on the theory that it restored dropped
`strict`/`target`/`lib`. When that theory was measured and failed, the change was **reverted** — a
config churn with no demonstrated behavioural difference is not worth shipping. The transforms are
unchanged from master.

**The tell that was missed:** request-service's suites passed on 29.4.6 *under node10*, which
node10 structurally cannot do for an `exports`-only subpath. That "impossible pass" was a
resolution-cache accident and should have been treated as the anomaly to explain, not as the
baseline of correctness.
