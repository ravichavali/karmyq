# Sprint 104 — Recommendation & Sprint 105 Scope

**Date:** 2026-06-17
**Status:** **DECIDED (2026-06-17, maintainer) — "A-plus".** Direction A is the official S105 scope;
Direction B contributes optional token hooks only (default off / sparse); Direction C parked. Verdict
recorded in §"Maintainer verdict" below.
**Inputs:** [`ux-audit.md`](ux-audit.md) (current state + cross-cluster drift),
[`visual-research.md`](visual-research.md) (references + three directions), [`mockups/`](mockups/)
(A/B/C contact sheet).

---

## Recommendation (as decided): **"A-plus" — Direction A scope, B-compatible foundation, C parked**

> The S104 research originally led with Direction B. On review the maintainer chose **"A-plus"**:
> adopt **Direction A** as the official, mandated S105 scope — *finish the warm system everywhere*,
> with **no new visual personality required** — while building the foundation so it is
> **B-compatible**: add the token hooks for paper grain / leaf motif / a smoother serif ramp, but ship
> the expressive layer **off by default or applied sparingly** (finite states and section dividers
> only), and only after seeing it in the real app. **Park C.**

**Why this is the right call (and why "A" here is not timid):** S104's strongest finding is not "the
app needs to be prettier" — it is **"the app is half-converted."** Request feed **2.1** vs Community
**4.4** is real product drift that makes Karmyq feel *less intentional than it already is*. Direction A
fixes exactly that: kill the cold SaaS fossils, remove the `% Match` badge, and standardize cards,
width, status colors, finite states, and typography. That **is** a meaningful facelift —
*"make the product finally look like the best page it already has."* The danger to avoid is letting
"facelift" become "new costume"; A-plus keeps the personality the same and makes it *consistent*.

### The three directions, and what "A-plus" takes from each

| | **A — Tidy Commons (scope)** | B — Field Guide (hooks only) | C — Almanac |
|---|---|---|---|
| Closes the cross-cluster drift (P1–P7) | ✅ **mandated** | — | — |
| New visual personality | none required | optional, sparse, default-off | (parked) |
| Stays inside the shipped/approved aesthetic | ✅ | ✅ | ⚠ largest departure |
| Survives per-community re-skin cleanly | ✅ | ✅ (texture behind a token, default off) | ⚠ decorative accent risk |
| Risk / effort | low / low | adds only token plumbing | high / high |
| **S105 disposition** | **official scope** | **garnish: token hooks now, enable sparingly later** | **parked** |

- **A is the scope.** P1–P7 (one reading column, one card primitive, one radius, smooth-enough serif
  ramp, color-from-tokens, quiet density, warm finite states) are the mandate. No expressive work is
  *required* for S105 to be a success.
- **B is a garnish, not a deliverable.** Build the `--texture` / motif / serif-ramp token hooks into
  the S105.0 foundation so nothing has to be re-plumbed later, but leave texture **off by default**
  (or scoped to finite states / section dividers) until it's been seen in the running app and judged
  worth turning up. This preserves the option without spending S105 on personality.
- **C is parked.** Bolder display pressures "quiet density" and decorative per-community accent raises
  re-skin-collision risk; it departs furthest from the aesthetic approved in
  `sprint-88-recommendation.md` §5. Revisit only if a future sprint explicitly wants a bolder step.

### What A-plus closes on the scorecard

Direction A alone lifts the two weak clusters to parity with the community page (the existing 4.4) —
the convergence does the work; the optional B garnish is upside, not the reason the scores move:

| Cluster | S104 avg | Projected post-A | What moves it (convergence alone) |
|---------|:--------:|:----------------:|---------------|
| Request feed + detail | **2.1** | ~4.2 | Reskin/retire the fossil feed; one card system; tokens for color/status; one reading column |
| Profile + global chrome | **2.9** | ~4.2 | `.kq-card` body; serif title bar; token greens; drop raw grays |
| Dashboard / Home | 4.0 | ~4.5 | Token the on-duty pill + selector; warm zero-community state; secondary-altitude Home |
| Community page | 4.4 | ~4.6 | Token the red dot; tighten the ramp (already the reference) |

---

## Per-cluster S105 change list (sized to become tasks)

Each bullet is a concrete token or component change. **Shared foundation first** (it unblocks every
cluster), then per-cluster propagation.

### S105.0 — Token & component foundation (do first)

*Direction A is the mandate here; the last bullet is the B-compatible garnish — build the hooks,
leave the personality off by default.*

- **Add tokens to `globals.css :root`:** `--measure` (one reading column = `max-w-2xl`),
  `--radius-card`. **(A, required.)**
- **Add `kq-headline-sm`** (26px Fraunces) to `karmyq-shell.css` — fills the 30px→body gap that
  `requests/[id].tsx:169` currently hand-rolls with an inline `style`. **(A, required.)**
- **Settle the card primitive:** make `.kq-card` (border, no shadow, one radius) the only card; mark
  `.card`/`.feed-card` shadow variants for migration/removal in `globals.css`. **(A, required.)**
- **Map status + urgency to semantic tokens** in one helper (extend `lib/requestActionCopy.ts` or a
  sibling) so no surface renders raw DB strings or raw Tailwind colors. **(A, required.)**
- **Promote `kq-finite-state`** to the single empty/caught-up/closed component. **(A, required.)**
- **Add the B-compatible hooks only:** define a `--texture` token (the grain layer) **defaulting to
  `none`/off**, plus the `kq-headline`→`kq-hero-name` serif-ramp names and a leaf-motif class reusing
  `karmyq-mark.svg`. **Do not enable texture app-wide.** If used at all in S105, scope the motif to
  **finite states and section dividers only**, and turn texture up later **after seeing it in the
  running app**. **(B garnish — optional, default-off, sparse.)**

### S105.1 — Request feed + detail (headline target, worst score)
- **Decide feed fate:** reskin `pages/requests/index.tsx` to render the warm `UnifiedFeed`/`RequestCard`,
  **or** retire it and redirect to the dashboard feed. Do **not** keep a second, colder feed.
- Kill the `{matchScore}% Match` pill (`:285-294`); use `describeMatchSignal()` → `kq-quiet-meta`.
- Remove the "Show Curated Feed / Smart Filtering / Minimum Match Score" SaaS chrome (`:143-211`);
  if a "show more open" affordance is needed, use the low-altitude pattern from `sprint-88-recommendation.md` §1.
- Replace `max-w-7xl` with `--measure`; replace `red-600`/`yellow-100`/`gray-200` with `warn`/tokens.
- Request **detail**: swap the inline-Fraunces title for `kq-headline-sm`; `text-red-600` → `text-error`;
  humanize `{detail.urgency}`.
- Apply the same treatment to the `offers/index.tsx` and `matches/[id].tsx` fossils.

### S105.2 — Profile + global chrome
- Migrate every `profile.tsx` body card (`:533,629,752,845,993`) from `shadow-md` to `.kq-card`.
- Replace raw grays (`bg-gray-200/300/400`, `:592,603,645,795,892`) and `bg-red-100` error (`:489`)
  with token equivalents; set the page to `--measure` (from `max-w-4xl`).
- **Chrome:** make the `Layout` `title=` bar use serif `kq-headline`(-sm) instead of `text-3xl
  font-bold` (`Layout.tsx:227`); tokenize the availability toggle greens (`:59,164-169`); align the
  topbar width to `--measure`/`kq-page`.
- Consider (stretch, not required): a member-facing contribution / "what's fading" surface to close the
  remaining S87 promise-3/4 gap — but keep it a styling-first sprint unless explicitly scoped.

### S105.3 — Dashboard / Home
- Tokenize the on-duty pill (`bg-amber-100` → `warn`/`success`) and warm the community `<select>` row
  (`dashboard.tsx:153-170`).
- Use `kq-finite-state` for the zero-community empty state (`:186-200`).
- Design a **secondary Home altitude** for established users with an empty queue (recent helps,
  communities needing a hand) — the carried-forward "empty Home" gap; this is hierarchy/IA work, the
  one item in S105 that is more than restyle.

### S105.4 — Community page (reference; light touch)
- Tokenize the `bg-red-500` pending dot (`:178`) and `text-red-500` error (`:137`); add text/aria to
  the dot (not color-only).
- Apply the convergence tokens consistently; it is already the closest to target. (Any B garnish here
  stays default-off / sparse per the A-plus verdict.)

### Cross-cutting (fold in while touching every surface)
- **Accessibility pass:** the scorecard's flat 3 — verify contrast on token pairs, add visible focus
  states, ensure no signal is color-only (status, urgency, dots). Cheapest to do during the migration.

---

## Suggested S105 rollout order

1. **S105.0 foundation** (tokens + components) — unblocks everything, lands behind the existing UI.
2. **S105.1 Request feed** — highest score delta, highest traffic; the visible "facelift" proof point.
3. **S105.2 Profile + chrome** — the other low cluster; chrome touches every page.
4. **S105.3 Dashboard** polish + the empty-Home altitude (the one non-styling design item).
5. **S105.4 Community** light polish (token the red dot; no app-wide texture — garnish stays off-default).
6. Per-surface deploy + demo validation (S105 is a deploy sprint, unlike S104).

Each step is a branch + PR; the foundation (S105.0) should merge before the propagation PRs so they
all consume the same tokens.

---

## Maintainer verdict (2026-06-17)

> The PRE-merge direction review presents the audit + scorecard + the A/B/C mockup contact sheet
> (`mockups/index.html`) to the maintainer. Recorded here before merge (mirrors the
> `sprint-88-recommendation.md` §5 verdict pattern).

- **Verdict:** **"A-plus"** — ☑ **Direction A is the official S105 scope** (finish the warm system
  everywhere; no new visual personality required) · **Direction B = optional, default-off token hooks
  only** (paper grain / leaf motif / serif ramp; if used, sparse — finite states + section dividers,
  and only after seeing it in the real app) · **Direction C parked.**
- **Reasoning (maintainer / Codex review):** S104's strongest finding is "the app is half-converted,"
  not "needs prettier UI" — Request feed 2.1 vs Community 4.4 is real drift that makes the product feel
  less intentional than it is. Direction A *is* a meaningful facelift ("make the product finally look
  like the best page it already has"); the risk to avoid is letting "facelift" become "new costume."
  Keep the personality the same; make it consistent. B's expressive layer is upside to dial up later,
  not an S105 deliverable.
- **Recorded by / date:** Maintainer (via Codex review, relayed through Claude), 2026-06-17.

---

## Housekeeping for S105 (not fixed here)

- **Version drift:** `apps/frontend/package.json` reads **11.10.0** while the S103 handoff tracks
  **v11.12.0**. S104 is research/no-deploy and does **not** bump versions. S105 should reconcile this
  as part of its release (the handoff's multi-sprint arc already notes it).
- **ADR-079** ships **Proposed** in S104; S105 advances it Accepted → Implemented as the direction
  lands surface-by-surface.
- **`docs/BUGS.md`:** BUG-011 / BUG-012 are fixed (S103) but still marked `open` — close when
  convenient (orthogonal to this sprint).
