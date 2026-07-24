# Sprint 120 PR C — Five-Second Clarity Audit

**Status:** COMPLETE. Audit done for the states/surfaces listed under Coverage (Tasks 2–3); the
maintainer selected **R-1…R-8** at the Task 4 checkpoint (see the selection section at the foot of
this doc) and those fixes shipped in PR
[#158](https://github.com/ravichavali/karmyq/pull/158) at v11.32.0.
**Sprint:** 120 · **PR:** C · **Branch:** `feature/sprint-120-five-second-clarity`
**Plan:** [`docs/superpowers/plans/2026-07-16-sprint-120-pr-c-five-second-clarity.md`](../plans/2026-07-16-sprint-120-pr-c-five-second-clarity.md)
**Spec:** [`docs/superpowers/specs/2026-07-16-sprint-120-true-scores-one-seed-clarity-design.md`](../specs/2026-07-16-sprint-120-true-scores-one-seed-clarity-design.md)

---

## Protocol

For each **surface × viewport × applicable state**: screenshot cold, then answer, timing each —

- **(a) What is this page?**
- **(b) What can I do here?**
- **(c) What should I do next?**

Record, per answer: time-to-answer and **which visual element answered it, named in words** (this
doc must stand alone; screenshots are session-scratchpad evidence, never committed and never
something a finding depends on). Severity per finding: **blocker** (a of the three unanswerable) /
**friction** (answerable but slow or ambiguous) / **polish**.

**Viewports:** 1440px desktop and 375px mobile.

### Rules of engagement (non-negotiable)

- **Read-only on demo.** No signups, no writes, no mutation of protected personas
  (`maria.reyes`, `elena.torres`, `noah.williams`, `marcus.lee@test.karmyq.com`).
- **Never manufacture a state.** First-arrival is audited only if a read-only DB check finds an
  existing sim account already in it; otherwise the surface is marked *not auditable this pass*.
- **Demo graph is sparse** (avg ~4.6 connections). Check a DB degree query before calling a graph
  surface broken. `maria.reyes` is the rich view.
- **Don't re-litigate shipped work.** `kq-topnav` is xl-only by design (BUG-016);
  `--measure-chrome: 72rem` is S119 header lever 1. S115/S118/S119 graph contracts (ring
  rotation/anchor, decayTier bands, `new > caller > focused`, fail-closed `active_recently`,
  truthful legend colors) are pinned — a finding against them is a *proposal*, not a defect.
- Console errors / broken states seen in passing get logged to `docs/BUGS.md`; never fixed inline.

## States

| # | State | How it is obtained (read-only) |
|---|-------|-------------------------------|
| S0 | **Unauthenticated** | Cold browser, no session |
| S1 | **First-arrival** | Existing sim account still in arrival state, found via read-only DB check — TBD Task 2; if none, states-not-auditable is recorded |
| S2 | **Sparse established member** | Low-degree sim account picked by read-only psql degree query — account recorded here at Task 2 |
| S3 | **Rich established member** | `maria.reyes` |

## Surface × State applicability matrix

Legend: ✅ audit · — not reachable in that state · ❔ conditional (resolve at Task 2).

| # | Surface | Route / entry | S0 | S1 | S2 | S3 |
|---|---------|---------------|----|----|----|----|
| 1 | Landing site home | `apps/landing` `/` | ✅ | — | — | — |
| 2 | Login | `/login` | ✅ | — | — | — |
| 3 | Register | `/register` | ✅ | — | — | — |
| 4 | Invite arrival | `/invite/[code]` | ❔ (needs a live unconsumed code) | — | — | — |
| 5 | Welcome / arrival | `/welcome` | — | ✅ | ❔ | ❔ |
| 6 | Demo tour | `/demo` | ✅ | ❔ | ❔ | ❔ |
| 7 | Dashboard home | `/dashboard` | — | ✅ | ✅ | ✅ |
| 8 | Feed | `/requests` | — | ✅ | ✅ | ✅ |
| 9 | Request detail | `/requests/[id]` | — | ❔ | ✅ | ✅ |
| 10 | Create request | `RequestWizard` (modal from `/dashboard`) | — | ✅ | ✅ | ✅ |
| 11 | Communities list | `/communities` | — | ✅ | ✅ | ✅ |
| 12 | Community detail (Browse / steward tabs) | `/communities/[id]` | — | ❔ | ✅ | ✅ |
| 13 | My Network — ego / community ring / hub | `/network` | — | ✅ (sparse-by-definition) | ✅ | ✅ |
| 14 | Profile | `/profile` | — | ✅ | ✅ | ✅ |
| 15 | Match / messaging thread | `/matches/[id]` | — | — | ❔ | ✅ |
| 16 | Notifications | `/notifications` | — | ✅ | ✅ | ✅ |
| 17 | Topbar + overflow menu (md → xl rhythm) | global chrome | ✅ | ✅ | ✅ | ✅ |

Conditionals resolve at Task 2 and the resolution is recorded in-line with the finding entry.

## State resolution (read-only DB, 2026-07-22)

Query run inside the demo `karmyq-postgres` container (SELECTs only; script kept in the session
scratchpad as `audit-states.sql`):

- **S1 first-arrival — NOT AUDITABLE THIS PASS.** `auth.users LEFT JOIN communities.members` returns
  **0 users without a membership**. Per the rules of engagement no account was created to
  manufacture the state, so `/welcome` in true arrival is unaudited. The *effective* arrival
  experience that IS reachable — the onboarding overlays on a cleared client — is audited below as
  F-1 and applies to every state.
- **S2 sparse — `takeshi.osei6315@test.karmyq.com`** (degree **1**, 4 communities, created
  2026-07-18). Degree distribution over `social_graph.trust_edges` runs 1 → 62; the lowest band is
  well populated (19 users at degree 1, 28 at 2, 41 at 3), so this account is representative rather
  than pathological. Five sim members sit at degree 0 despite 5–11 memberships.
- **S3 rich — `maria.reyes@test.karmyq.com`, degree 4, 6 communities.** Worth recording: the
  designated "rich view" is **below the demo's own median** (max degree is 62;
  `maria.reyes5130@test.karmyq.com` has 8). Every graph surface judged through Maria is being judged
  at 4 nodes. This is a demo-data observation, not a product defect.

## Coverage

Audited: app root `/` (S0, both viewports), `/login` + `/register` (S0, 375), `/demo` (S0, 375),
landing site `karmyq.org` (S0, 375), `/dashboard` (S3 1440 + 375, S2 1440), `/network` (S3 1440 +
375, S2 1440), `/communities` (S3 1440).

**Not audited this pass** (recorded honestly rather than assumed): request detail, the
`RequestWizard` create flow, community detail + steward tabs, profile, notifications, the
`/matches/[id]` messaging thread, `/invite/[code]`, and the md→lg topbar rhythm. The findings below
were sufficient to produce a ranked quick-win list; extending coverage is a named option at the
Task 4 checkpoint.

## Findings

Severity: **blocker** (one of the three questions is unanswerable) / **friction** / **polish**.

### F-1 — Two stacked modal tours fire before any content is visible · blocker · S2 + S3 · both viewports

On login with a cold client, `/dashboard` renders behind a centred **"Welcome to Karmyq!" modal
(3 dots, Skip / Next)**; skipping it immediately raises a **second** modal, **"Your Feed — 1 of 7"**.
Every subsequent page repeats the pattern with its own workflow tour — `/communities` opens
**"Communities — 1 of 6"**. The five-second test cannot start: at t=5s the visible page is a grey
scrim and a paragraph of prose. Both overlays are dismissible, so the cost is one-time per client,
but the first impression of the product is two dialogs, not the product. Same behaviour for the
sparse member (S2) and the rich member (S3).

### F-2 — Community names arrive mojibaked in the "Your Communities" chips · friction · S3 · 1440

`/communities` renders the membership chips as **"Southeast PDX Helpers â□□ Group B â□□ Group B"**,
while the *same* community's name renders correctly as "Southeast PDX Helpers — Group B" in the
dashboard feed card. The database is clean: `encode(convert_to(name,'UTF8'),'hex')` returns
`…20e28094 20…` (a proper U+2014 em dash). The corruption is client-side — those chips are built
from the JWT payload, decoded with bare `atob()`, which yields Latin-1 bytes rather than UTF-8
characters. Five `atob()` JWT decode sites exist: [api.ts:47](../../../apps/frontend/src/lib/api.ts#L47),
[communities/index.tsx:233](../../../apps/frontend/src/pages/communities/index.tsx#L233) and
[:341](../../../apps/frontend/src/pages/communities/index.tsx#L341),
[communities/[id].tsx:103](../../../apps/frontend/src/pages/communities/[id].tsx#L103),
[demo.tsx:35](../../../apps/frontend/src/pages/demo.tsx#L35). Any non-ASCII in a community or
person's name — an accent, an em dash, a non-Latin script — is mangled wherever JWT-sourced state
is displayed.

### F-3 — The page scrolls sideways at 375px · friction · S3 · 375

On `/dashboard` at 375px the document reports `clientWidth 360 / scrollWidth 470` — **110px of
horizontal page overflow**, with a page-level horizontal scrollbar under the bottom tab bar. The
offender measured at `right: 470px` is the **Community `<select>`** in the selector row
([dashboard.tsx:154](../../../apps/frontend/src/pages/dashboard.tsx#L154)): it carries no width
constraint, so its intrinsic width is set by the longest option text ("Southeast PDX Helpers —
Group B — Group B"). The control is visibly clipped by the right edge, and the whole page inherits
the sideways scroll. Community names grow with sim churn, so this worsens over time.

### F-4 — The first screenful spends itself on chrome and a promo card · friction · S2 + S3 · both viewports

At 1440 the `/dashboard` fold contains, in order: topbar, community selector row, Browse/Helping/Asks
tabs, the "HOME" eyebrow, the greeting "Good to see you, Maria Reyes.", a two-line lede, the
**"My Network … Explore →" promotional card**, a filter chip row — and only then, at roughly
y=555 of 900, the first actual ask ("Grocery pickup for elderly neighbour"). At 375px the same
stack pushes the first ask entirely below the fold. The element answering "what can I do here?"
in the first five seconds is a promo for a different page, not a request you can fill.

### F-5 — The graph canvas is mostly empty, and the sparse state is a dead end · friction · S2 + S3 · both viewports

`/network` (Scale 1 · My Network) draws Maria's four first-degree neighbours as a ~200px ring
centred in a ~1440×600 canvas — the rest is blank cream, with the five-item relationship legend
stranded in the bottom-left corner far from anything it explains. For the sparse member the same
canvas holds **one node and one line** ("Showing 1 person within 1 hop"), with a five-category
legend above it and no call to action anywhere: the answer to "what should I do next?" is nothing.
Node labels are pale grey on cream at small type; at 375px "Maria Reyes" and "James Okafor"
visually collide. **Not a data defect** — 4 and 1 match the DB degrees exactly.

### F-6 — The active mode pill is off-palette · polish · S2 + S3 · both viewports

On `/network` the selected mode ("My Network") is a saturated **indigo/purple** pill, the only
non-green primary in an otherwise green-on-cream product. The two inactive modes ("This Community",
"Across Communities") are plain text, so the pill is also the strongest colour on the page.

### F-7 — Login and register drop the brand entirely · polish · S0 · 375

`/login` renders a bare card headed **"Login"** with two fields, a button, and a "Don't have an
account? Register" line — no wordmark, no product line, no route back to `/`. A cold visitor
arriving on a shared link sees an unbranded form. `/register` is better (it carries the "Have an
invitation?" note) but is equally unbranded. Neither page offers password recovery.

### F-8 — `/demo` is the best five-second asset in the product and nothing links to it · friction · S0 · both viewports

`/demo` answers all three questions in about two seconds: "See how help travels through trust", an
explicit **"This is a read-only guided tour … as Maria, a synthetic demo neighbour"**, one primary
**"Explore the live demo as Maria"**, and a secondary "Join the Platform / Log in" pair. The app
root `/` — the page a cold visitor actually lands on — offers only "Get started" and "Log in" and
never mentions the tour exists. The root's three explainer cards sit in a ~640px column in a 1440px
viewport with the lower half of the screen empty, and there is no nav, no footer, and no link to
`karmyq.org`.

### F-9 — `/communities` fires 32 failing requests on load · polish (console noise) · S3 · 1440

One page load produced **32 console errors**, all
`GET /api/reputation/community-trust/{id} → 404`. The body is a well-formed ADR-074 envelope —
`{"success":false,"message":"Community aggregate not available","error":"AGGREGATE_NOT_AVAILABLE"}`
— i.e. an ordinary "no aggregate yet" empty state transported as a 404, once per community card.
Nothing is visibly broken; the cost is a red console for anyone inspecting the demo, plus one
request per card. Logged to `docs/BUGS.md`; not fixed inline.

### F-10 — The dashboard promises relationship-led ranking a sparse member does not have · friction · S2 · 1440

The lede under the greeting reads "A calm queue of asks you can fill, **led by the relationships
that make help possible**." The degree-1 member sees exactly the same sentence, the same feed
shape, and the same "My Network" promo card as the rich member — with one relationship to lead
with. Nothing on the page acknowledges the empty state or offers the first step that would build
it.

## Reference comparison

| Product | What answers its five-second test | What ours does instead |
|---|---|---|
| **Nextdoor** | The fold is *content*: real posts from named neighbours with photos, above any explanation. Identity ("Your neighbourhood, Sellwood") is a small label, not a headline. | Our fold is eyebrow + greeting + lede + promo card; the first real ask lands at ~60% of the viewport height (F-4). |
| **Buy Nothing / Facebook group** | One unmistakable primary action ("Write something…" / "Ask for something") sitting *inside* the content column, plus a member count and recent-activity proof. | Our create action is an **unlabelled circular `+` FAB** floating over the feed; at 375px it overlaps the first card's community chip. Nothing shows how alive a community is until you open it. |
| **Discord community home** | Empty states are never blank: an empty channel says what it is for and gives the one action that fills it. | The one-node `/network` and the sparse dashboard say nothing about being empty and offer no next step (F-5, F-10). |
| **TimeBanks** | Explains the non-money exchange model *and* shows live listings on the same first screen. | The model is explained well on `/demo` — which nothing links to (F-8) — while `/` explains without proof and shows no activity. |

The through-line: reference products spend the first screen on **evidence** (real posts, real
people, real counts) and put explanation second. Karmyq currently inverts that in every
authenticated state, and its single best explanatory surface is unreachable from the front door.

## Ranked recommendations

Effort is a rough implementation estimate for this PR (tests included).

| # | Recommendation | Addresses | Effort | Recommended bucket |
|---|---|---|---|---|
| R-1 | **UTF-8-safe JWT decode** — one shared helper (decode base64url → `TextDecoder('utf-8')`), adopted at all five `atob()` sites | F-2 | S (~1h) | **Quick win — this PR** ✅ strongly recommended |
| R-2 | **Constrain the community `<select>`** (`min-w-0` wrapper + `max-w-full`/truncation) so 375px stops scrolling sideways | F-3 | S (~1h) | **Quick win — this PR** ✅ strongly recommended |
| R-3 | **Link `/demo` from the app root** — a third CTA ("See how it works — 2-minute tour") beside Get started / Log in | F-8 | S (~1h) | **Quick win — this PR** ✅ recommended |
| R-4 | **Brand the auth pages** — wordmark + one-line product statement above the Login/Create Account card, wordmark links `/` | F-7 | S (~1h) | **Quick win — this PR** ✅ recommended |
| R-5 | **Label the create action** — turn the bare `+` FAB into a labelled "Ask for help" control and stop it overlapping the first card at 375px | F-4, reference row 2 | S–M (~2h) | Quick win — this PR (judgement call) |
| R-6 | **Don't stack tours** — suppress the workflow tour when the welcome modal ran in the same session; at most one overlay per visit | F-1 | M (~3h, touches `onboarding/workflows.ts` + tests) | Quick win if the maintainer wants the first impression fixed now |
| R-7 | **Purposeful empty state on `/network`** — when degree ≤ 1, replace the empty canvas with "Your network grows when you help someone" + a link into the feed | F-5, F-10 | M (~3h) | Quick win or defer |
| R-8 | **Recolour the active mode pill** to the green primary | F-6 | XS (~20m) | Quick win — trivial, ships with anything else |
| R-9 | **Raise content above the fold** — collapse the greeting/lede block and demote the "My Network" promo below the first two asks | F-4 | M–L | **Structural → `docs/IDEAS.md`** (touches shipped S119 hierarchy; deserves its own design pass) |
| R-10 | **Sparse-member first-run path** — a real "here's how you get your first connection" flow | F-10 | L | **Structural → `docs/IDEAS.md`** |
| R-11 | **Stop 404-ing an empty aggregate** (200 + null, or batch the lookup) | F-9 | S–M | **Out of scope for a UX PR** — logged in `docs/BUGS.md` |
| R-12 | Graph label contrast / collision at 375px | F-5 | M | Defer — touches pinned S115/S118/S119 encoding contracts |

**Recommendation:** ship **R-1, R-2, R-3, R-4, R-8** — five small, independently testable
presentation fixes that between them kill the only hard layout defect, the only data-corruption
symptom, and the two worst first-impression gaps, with no risk to any pinned graph or header
contract. Add **R-5** and **R-6** if the maintainer wants the first-impression story properly
closed this sprint; both are still presentation-layer but each carries real test surface.

## Maintainer selection (Task 4 checkpoint) — 2026-07-22

**Selected for PR C: R-1, R-2, R-3, R-4, R-5, R-6, R-7, R-8** — the maintainer took the recommended
five plus both judgement-call items (R-5 labelled create action, R-6 no stacked tours) and R-7
(purposeful sparse `/network` state). Rationale: every selected item is presentation-layer, none
touches a pinned S115/S118/S119 graph or header contract, and together they close the whole
first-impression story rather than only the two hard defects.

**Deferred to `docs/IDEAS.md`:** R-9 (raise content above the fold — needs its own design pass over
shipped S119 hierarchy), R-10 (sparse-member first-run path), R-12 (graph label contrast/collision).

**Out of scope, logged as bugs:** R-11 → `BUG-031`. `BUG-032` is the bug record for R-1.

**Coverage decision:** proceed on the audited surfaces. The seven unaudited surfaces listed above
carry forward to a future pass rather than blocking this PR.

Concrete files, tests, and verification for each selected fix are written into
[the PR C plan](../plans/2026-07-16-sprint-120-pr-c-five-second-clarity.md), Tasks 5–7.
