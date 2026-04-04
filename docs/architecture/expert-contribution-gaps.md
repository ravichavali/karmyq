# Expert Contribution Gaps — Sprint 44 Architecture Review

**Date**: 2026-04-04
**Author**: Sprint 44 review
**Purpose**: Identify where domain experts (community founders, admins, providers) still require
             developer involvement to make configuration or content changes.
             Feeds Sprint 45+ prioritization.

---

## 1. Trust Model Configuration (ADR-044)

### Current State

ADR-044 implemented a six-question frontend questionnaire that maps human-readable answers
(e.g. "Who is this community for?") to numeric config fields. The questionnaire drives
community creation (`/communities/new` — step `questionnaire`) and a "Revisit trust model"
diff flow for existing communities.

The config is stored in `communities.community_configs` with 17+ fields including:
- `trust_depth_weight`, `trust_breadth_weight` (must sum to 1.0)
- `karma_split_helper`, `karma_split_requestor`
- `trust_path_max_hops`, `min_interactions_for_trust`
- `new_member_karma_lockout_days`

The questionnaire is implemented entirely in the frontend (`apps/frontend/src/lib/trust-model.ts`,
`CommunityTrustQuestionnaire.tsx`, `TrustModelDiff.tsx`). Three preset templates exist in the
DB seed (Cohousing Default, Neighborhood Cautious, Experimental Reciprocal).

### Gap

**Founders cannot add new questionnaire options without a code change.** The `QUESTIONS` array
in `trust-model.ts` is hardcoded. Adding a new question, reordering questions, or changing
answer-to-config mappings requires a developer PR and deployment.

The "Revisit trust model" flow requires founders to navigate to the admin config panel, apply
the questionnaire, review a diff, and selectively apply — multi-step and non-obvious. No
admin-facing documentation or guided flow exists in the product UI.

### Priority

**High.** Community design is the highest-leverage lever founders have. Blocking question
changes on a dev deploy is a significant bottleneck as the platform grows past initial cohorts.

### Recommended Next Step (Sprint 45+)

Externalize the `QUESTIONS` array to a DB table or server-side config endpoint. Admin UI
can manage questions without a code change. Optionally, expose an admin page with a
plain-language explanation of each config field and its effect.

---

## 2. Feed Weight Configuration (ADR-048)

### Current State

ADR-048 (Feed Ranking v2) added seven scoring signals. Feed weights are stored per-community
in `communities.community_configs`:
- `feed_weight_skill_match` (default 0.40)
- `feed_weight_trust_distance` (default 0.25)
- `feed_weight_community_relevance` (default 0.20)
- `feed_weight_urgency` (default 0.15)
- Three additional v2 signals (social_karma, recency, prior_interaction) are computed in
  `socialKarmaFeedComposer.ts` but not yet exposed as per-community config fields.

DB has a constraint: `feed_weight_skill_match + feed_weight_trust_distance +
feed_weight_community_relevance + feed_weight_urgency` must sum to 1.0 (±0.01).

The admin config UI at `/communities/[id]/admin` exposes these four weights via sliders.

### Gap

**Three of the seven v2 signals have no per-community weight knobs.** `social_karma`,
`recency`, and `prior_interaction` weights are hardcoded in `socialKarmaFeedComposer.ts`.
Admins cannot tune them without a code change.

The four configurable weights sum-to-1.0 constraint is enforced in the DB but not explained
in the UI — admins changing one weight get a confusing "constraint violation" error unless
they simultaneously adjust another weight.

### Priority

**Medium.** The current four-weight system produces reasonable default behavior. The v2
signal gap affects communities that want to prioritize social engagement or recency over
skill-matching — a real use case but not blocking for initial deployments.

### Recommended Next Step (Sprint 45+)

1. Add `feed_weight_social_karma`, `feed_weight_recency`, `feed_weight_prior_interaction`
   columns to `community_configs` (new migration).
2. Remove the rigid sum-to-1.0 constraint — replace with a normalization step in
   `socialKarmaFeedComposer` so any non-negative weight combination is valid.
3. Admin UI: show all seven weight sliders with live "preview total" to guide admins.

---

## 3. Request Type Schemas (ADR-032)

### Current State

ADR-032 (Server-Driven UI) stores request type schemas in `requests.ui_schemas`. The admin
panel at `/admin/schemas` allows platform admins to create, version, and edit schemas via a
JSON editor UI. Schemas define field structure, validation, and UI hints for each request
type (generic, ride, service, event, borrow).

The schema editor (`/admin/schemas/new`, `/admin/schemas/[id]/edit`) is functional and
accepts raw JSON. Schema versioning and activation flows exist.

### Gap

**The JSON editor requires understanding the schema format.** Non-developer admins face a
blank text area with no field-level documentation, type hints, or preview of how the schema
renders as a form. Errors surface as raw validation messages.

There is no way for a community admin (non-platform-admin) to propose a custom request type
for their community — schemas are platform-global. A cohousing community that wants a
"meal-share" request type cannot create one without involving a platform admin.

### Priority

**High.** Custom request types are a differentiator for community autonomy. The JSON editor
is a developer tool masquerading as an admin feature.

### Recommended Next Step (Sprint 45+)

1. Add a visual field-builder to the schema editor (drag-and-drop fields with type pickers).
2. Add live preview: show the schema as a rendered form as the admin edits.
3. Introduce community-scoped schemas — allow community admins to create "local" request types
   visible only in their community, subject to platform admin approval.

---

## 4. Provider Directory Self-Management

### Current State

Providers can self-register, edit, and delete their own profiles via `POST/PUT/DELETE
/requests/providers` (owner-only, auth-required). Rate cards are self-managed at
`/requests/providers/:id/rate-cards`. Availability toggling exists at
`/requests/providers/:id/availability`.

The frontend at `/providers/[id]` shows provider profiles. The `ProviderProfileTab`
component in the dashboard allows providers to manage their own rate cards.

### Gap

**No provider-facing "my profile is live" feedback loop.** After creating a profile, a
provider has no indication of how many users viewed their profile, how many requests were
sent to them, or how their trust score compares to others in the directory.

**Provider collective management** (`/requests/collectives`) has no self-serve onboarding.
A provider cannot create a new collective or apply to join an existing one from the UI —
both are admin-only in the current frontend.

**No admin dashboard for provider moderation.** If a provider receives complaints or bad
reviews, there is no admin-facing UI to suspend or flag their profile. This must be done
via direct DB query.

### Priority

**Medium.** Current provider count is low (early stage). But the feedback loop gap affects
provider retention, and the moderation gap becomes critical as the provider count grows.

### Recommended Next Step (Sprint 45+)

1. Provider analytics page: show profile view count, request-match count, avg response time.
2. Collective self-service: allow providers to create and manage collectives from the provider
   profile UI.
3. Admin moderation dashboard: flag, suspend, or review provider profiles.

---

## 5. Observability Access

### Current State

Sprint 44 propagated structured logging (`req.logger?.error(...)`) into all 8 service route
handlers and added `requestLoggingMiddleware` to social-graph-service and cleanup-service.
All errors now emit `{ service, endpoint/step, error.message }` context objects.

Frontend errors surface via the new `ErrorBoundary` in `_app.tsx` with `{ component, error,
stack }` shape. API call failures log `{ error: err.message }` structured objects.

Logs are accessible via `pm2 logs <service-name>` on the demo server, or via stdout in
Docker containers.

### Gap

**No in-product error visibility for admins or operators.** To diagnose an issue, an operator
must SSH to `karmyq.com` and run `pm2 logs`. There is no admin dashboard, no error
aggregation, no alerting.

**No log aggregation.** Logs are emitted to stdout per-service but not shipped to a central
store (no Loki, Datadog, CloudWatch, etc.). Structured JSON output is ready for aggregation
but nothing is consuming it.

**No performance observability.** Request latency, slow queries, and queue depth are
invisible without manual log scanning.

### Priority

**Medium.** The structured log format is now in place — this is the prerequisite. Adding
aggregation and an admin dashboard is the next unlock.

### Recommended Next Step (Sprint 45+)

1. Stand up a lightweight log aggregator (Loki + Grafana, or equivalent) on the demo server.
2. Create an admin-facing "platform health" page showing recent error counts per service,
   with a filtered log viewer for non-engineers.
3. Add PM2 memory/CPU metrics to the existing health check endpoint for visibility without
   server access.

---

## Summary Priority Matrix

| Area | Priority | Blocking? | Sprint |
|------|----------|-----------|--------|
| 3. Request Type Schema Editor (visual builder) | High | No | 45 |
| 1. Trust Model Questionnaire Externalization | High | No | 45 |
| 2. Feed Weight v2 Signal Config | Medium | No | 45+ |
| 5. Log Aggregation + Admin Dashboard | Medium | No | 46 |
| 4. Provider Analytics + Moderation | Medium | No | 46 |

---

## Deferred Dependency Upgrades (npm)

The following packages could not be upgraded in Sprint 44 due to being locked inside
transitive dependency trees. They are tracked as deferred tech debt:

| Package | Current | Vulnerability | Locked By | Action |
|---------|---------|---------------|-----------|--------|
| `picomatch` | 3.0.1 | Method Injection (high) | `expo@54` | Upgrade Expo SDK |
| `node-forge` | 1.3.3 | Multiple crypto vulns (high) | `expo@54` / `@expo/cli` | Upgrade Expo SDK |
| `tar` | 7.5.7 | Path traversal (high) | `expo@54` / `@expo/cli` | Upgrade Expo SDK |

**Recommendation:** Upgrade Expo SDK from 54 → latest as a dedicated sprint task. All three
vulnerabilities are in the Expo CLI toolchain (dev-time only, not shipped in the app bundle),
so runtime risk is low.
