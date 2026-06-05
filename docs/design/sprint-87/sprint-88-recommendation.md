# Sprint 88 Recommendation — from the Product Truth & UX Reset

> **Status: APPROVED (2026-06-05) — basis for Sprint 88.** Records the decisions and the explicit S88
> first-implementation target derived from the Sprint 87 audit + mockups + presentation rules. The
> maintainer **approved** this direction (verdict at the bottom); the Sprint 88 implementation plan is
> written from it next.

---

## 1. Community feed `minScore` decision (locked: Decision 4)

**"Show all open" = three layers, never a firehose:**

1. **Curated-first default** — both `view=home` and `view=community` default to `minScore ≥ 30`. A member
   sees a *finite, relevant* set led by relationship/curation, not every open row.
2. **Low-altitude "show more open requests"** — a quiet member affordance (below the curated set / at the
   "you're caught up" boundary) that relaxes `minScore` to reveal the longer tail of open asks **on
   demand**. It is opt-in expansion, not the default surface.
3. **Admin all-status list** — the admin view (shipped in #64) keeps the full open/matched/completed
   list for stewardship. Unchanged; it is the admin altitude, not the member default.

**Why:** preserves the finite-queue calm of the member home while still honoring "a member can find every
open ask if they want to." The default is curated; the firehose is one deliberate tap away; the admin
gets the full ledger.

**Implementation note for S88:** `getCuratedRequests({ view, minScore })` already accepts `minScore`. The
"show more open" control re-requests with explicit `minScore=0`; the curated default stays `≥30`, and
omitting the param is not the show-more contract. S88 also fixes the backend parser so explicit `0` is
honored instead of being coerced back to `30` by `parseInt(...) || 30`. Pair this with the
carried-forward **home-feed impression-logging gap** (the `requests.feed_events` INSERT only fires on
the legacy array path of `handleCuratedFeed`, not the `view=home`/`view=community` union path) — S88 must
log impressions on both union views so curation has data.

**Executed in S88:** the backend `minScore=0` fix also repairs the pre-existing frontend Show All slider
that already sent `minScore: 0`.

## 2. Score-vs-relationship taxonomy applied to the RequestCard (Decision 3)

The card is redesigned **holistically in S88** (not piecemeal in S87). The rules, made concrete by
`mockups/request-card.html`:

- **Keep & promote `TrustPathBadge`** — the relationship reason ("via X" / "Direct connection") becomes
  the **lead** element of the card.
- **Remove the per-person `KarmaBadge` (`⭐ score`)** from the card entirely. This is the S88 home for the
  removal that S87 only documented.
- **De-emphasize match %** — render it as a soft qualitative signal ("good match", "close by") in a
  trailing meta line; never the prominent number.
- **Humanize the payload label** — map `category`/`payload_type` (`generic`, etc.) to human words via the
  normalization map (ADR-067 seam); never render the raw token.
- New card reading order: **relationship → ask → what's involved → action → quiet signal** (presentation
  rules §5).

## 3. Recommendation: build a shared shell + Dashboard Home **together** (recommended)

**Recommended:** S88 builds a small **shared design-system shell** (tokens, typography = Fraunces +
Hanken Grotesk, the card/badge/decision-band/finite-queue components from `mockups/shared.css`) **and**
re-skins **Dashboard Home** on top of it in the same sprint.

**Why together, not Dashboard-Home-alone:**
- The help loop is the **proof point** — it only reads as "warm commons, calm" if the shell (type, color
  discipline, one quiet notification, finite-queue states) lands with it. A re-skinned card on the old
  shell would still sit under two count-badge bells in an infinite scroll.
- The shell is the reusable substrate S89 (community), S90 (profile/trust), S91 (mobile) all build on —
  paying for it once in S88 de-risks the whole arc.
- Scope is contained: shell = tokens + ~6 components already prototyped in the mockups; Dashboard Home is
  one consumer. Not a full-app reskin (S89/S90 reskin their own surfaces).

**Explicit S88 first-implementation target (what the next plan executes first):**
> Stand up the shared shell (design tokens + Fraunces/Hanken type + `RequestCard`, `DecisionBand`,
> path-badge, finite-queue/"caught up" components) and ship **Dashboard Home (`view=home`)** on it:
> relationship-led card hierarchy, `KarmaBadge` removed, match-% demoted, `minScore≥30` curated default
> with a "show more open" affordance, impression logging on the `view=home` union path, one quiet
> notification affordance, and a finite "you're caught up" end-state. Mobile parity for this surface
> rides along (no FAB/CTA overlap). Community Home (`view=community`) re-skins next within S88 if budget
> allows, else opens S89.

## 4. Carry-forward into S88 (from the audit + roadmap)

- Seed of **"what fades"** (small) — the profile forgetting surface is S90, but seed the data/affordance
  in S88 per Decision 5.
- **RequestWizard copy** polish (keep the warm emoji type picker — the audit's best surface).
- **Product-truth bug fixes** that surfaced in the audit: em-dash **mojibake** in community-name
  rendering; cumulative **"— Group A — Group B"** fission names; **mobile FAB overlapping** the card CTA;
  empty community **KPI tiles**.

---

## 5. Direction review verdict (Task 14 — maintainer gate)

> The PRE-merge direction review presents the mockup contact sheet (`mockups/index.html`) +
> `presentation-rules.md` + `scorecard.md` to the maintainer. Record the verdict here before merge.

- **Verdict:** **APPROVED** (2026-06-05, maintainer)
- **Decision:** ☑ **Approved** — the warm-commons/calm direction in the mockups + presentation rules is
  the adopted basis for Sprint 88. · ☐ Revise · ☐ Deferred.
- **Notes:** Maintainer reviewed the mockups and approved ("they are good. I approve"). Every mockup +
  `presentation-rules.md` banner flipped **PROPOSED → APPROVED (2026-06-05)**. The `minScore` decision
  (§1), the score-vs-relationship taxonomy (§2), and the shell-first recommendation (§3) are the locked
  basis the **Sprint 88 implementation plan is written from next**. Codex PR review applied pre-merge
  (ARCHITECTURE source-of-truth fixes: SSE-auth + `communities` JWT field; handoff version state).
- **Recorded by / date:** Maintainer (via Claude), 2026-06-05.

_Verdict **Approved** → banners flipped to APPROVED; the Sprint 88 implementation plan is written from
this direction in the next planning pass (shared shell + Dashboard Home first, per §3)._
