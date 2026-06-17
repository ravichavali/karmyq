# Sprint 104 — Recommendation & Sprint 105 Scope

**Date:** 2026-06-17
**Status:** Proposed direction for maintainer review (no implementation in S104).
**Inputs:** [`ux-audit.md`](ux-audit.md) (current state + cross-cluster drift),
[`visual-research.md`](visual-research.md) (references + three directions), [`mockups/`](mockups/)
(A/B/C contact sheet).

---

## Recommendation: **Direction B — "Field Guide"**

Adopt **Direction B**: finish the warm-commons design system across all four clusters **and** add one
on-brand creative step (a whisper of paper grain, a smooth Fraunces type ramp, and a recurring
seed/leaf motif), all expressed as token deltas that survive per-community re-skinning.

### Why B over A and C

| | A — Tidy Commons | **B — Field Guide** | C — Almanac |
|---|---|---|---|
| Closes the cross-cluster drift (P1–P7) | ✅ | ✅ | ✅ |
| Adds genuine, on-brand character | ❌ none | ✅ one step | ✅✅ several |
| Stays inside the shipped/approved aesthetic | ✅ | ✅ | ⚠ largest departure |
| Survives per-community re-skin cleanly | ✅ | ✅ (texture behind a token) | ⚠ decorative accent risk |
| Risk / effort | low / low | **low-med / med** | high / high |

- **A** is correct but joyless — it makes the app *consistent* without making it *better* to look at.
  The maintainer asked for a "facelift," and A delivers a cleanup. Keep A as the **fallback** if S105
  budget is cut: P1–P7 alone are a real, shippable win.
- **C** is the most memorable but the riskiest: bolder display pressures "quiet density," and promoting
  the per-community accent into decorative rules means every community theme must be audited against
  the new usage. It also departs furthest from the aesthetic the maintainer already approved
  (`sprint-88-recommendation.md` §5). **Park C** as a future option, not this sprint's bet.
- **B** is the smallest step that actually reads as a facelift. The texture is one CSS layer behind a
  `--texture` token a re-skin can null out; the serif ramp just names steps the app already implies;
  the leaf motif reuses the existing `karmyq-mark.svg`. It earns character without spending the
  re-skin guarantee or re-opening the approved direction.

### What B closes on the scorecard

Adopting B lifts the two weak clusters to parity with the community page (the existing 4.4):

| Cluster | S104 avg | Projected post-B | What moves it |
|---------|:--------:|:----------------:|---------------|
| Request feed + detail | **2.1** | ~4.2 | Reskin/retire the fossil feed; one card system; tokens for color/status; one reading column |
| Profile + global chrome | **2.9** | ~4.2 | `.kq-card` body; serif title bar; token greens; drop raw grays |
| Dashboard / Home | 4.0 | ~4.5 | Token the on-duty pill + selector; warm zero-community state; secondary-altitude Home |
| Community page | 4.4 | ~4.6 | Token the red dot; texture/ramp polish (already the reference) |

---

## Per-cluster S105 change list (sized to become tasks)

Each bullet is a concrete token or component change. **Shared foundation first** (it unblocks every
cluster), then per-cluster propagation.

### S105.0 — Token & component foundation (do first)
- **Add tokens to `globals.css :root`:** `--measure` (one reading column = `max-w-2xl`),
  `--radius-card`, `--texture` (the grain layer; default on, nullable per skin).
- **Add `kq-headline-sm`** (26px Fraunces) to `karmyq-shell.css` — fills the 30px→body gap that
  `requests/[id].tsx:169` currently hand-rolls with an inline `style`.
- **Settle the card primitive:** make `.kq-card` (border, no shadow, one radius) the only card; mark
  `.card`/`.feed-card` shadow variants for migration/removal in `globals.css`.
- **Map status + urgency to semantic tokens** in one helper (extend `lib/requestActionCopy.ts` or a
  sibling) so no surface renders raw DB strings or raw Tailwind colors.
- **Promote `kq-finite-state`** to the single empty/caught-up/closed component.
- **Add the paper-grain + leaf motif** (B): one body `background-image` layer behind `--texture`; the
  `karmyq-mark.svg` reused as section-divider glyph + finite-state illustration.

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
- Apply the B texture/ramp/motif polish consistently (it is already the closest to target).

### Cross-cutting (fold in while touching every surface)
- **Accessibility pass:** the scorecard's flat 3 — verify contrast on token pairs, add visible focus
  states, ensure no signal is color-only (status, urgency, dots). Cheapest to do during the migration.

---

## Suggested S105 rollout order

1. **S105.0 foundation** (tokens + components) — unblocks everything, lands behind the existing UI.
2. **S105.1 Request feed** — highest score delta, highest traffic; the visible "facelift" proof point.
3. **S105.2 Profile + chrome** — the other low cluster; chrome touches every page.
4. **S105.3 Dashboard** polish + the empty-Home altitude (the one non-styling design item).
5. **S105.4 Community** light polish + B texture pass app-wide.
6. Per-surface deploy + demo validation (S105 is a deploy sprint, unlike S104).

Each step is a branch + PR; the foundation (S105.0) should merge before the propagation PRs so they
all consume the same tokens.

---

## Housekeeping for S105 (not fixed here)

- **Version drift:** `apps/frontend/package.json` reads **11.10.0** while the S103 handoff tracks
  **v11.12.0**. S104 is research/no-deploy and does **not** bump versions. S105 should reconcile this
  as part of its release (the handoff's multi-sprint arc already notes it).
- **ADR-079** ships **Proposed** in S104; S105 advances it Accepted → Implemented as the direction
  lands surface-by-surface.
- **`docs/BUGS.md`:** BUG-011 / BUG-012 are fixed (S103) but still marked `open` — close when
  convenient (orthogonal to this sprint).
