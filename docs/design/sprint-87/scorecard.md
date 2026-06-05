# Sprint 87 — Product-Polish Scorecard

**Date:** 2026-06-05 · **Sprint:** 87 (Product Truth & UX Reset)

The rubric the whole 88–92 arc is measured against. Each **founding promise** is scored on whether the
**current product surface makes it legible** (not whether the backend supports it — it mostly does). The
gap and target are grounded in the screenshot UX audit (`ux-audit.md`, member-login capture, post
data-cleanup). "Owning sprint" is where the fix lands in the locked roadmap.

**Legend — current state:** 🟥 absent/contradicted · 🟧 present but buried/technical · 🟩 legible & warm.

---

| # | Promise | Current surface state | Gap (what the audit found) | Target state | Owning sprint |
|---|---------|----------------------|----------------------------|--------------|---------------|
| 1 | **Community sovereignty** — each community is its own place, member-owned, Dunbar-bounded | 🟧 Community header carries mission + a `x / 150` cap bar (good). But Overview leads with a SaaS KPI tile row (3 of 4 empty), governance is raw thresholds, and split communities show cumulative names + em-dash mojibake. | Member-home altitude is buried under admin/accounting chrome; fission output ("— Group B — Group A", `â–®â–®`) makes communities hard to tell apart or claim as "mine". | A member-first community home: who's here, who needs what, what this place is for — accounting demoted; honest, human community names; staged fission/fusion with a picker. | **S89** (sovereignty redesign); name/mojibake bug-fix S88 |
| 2 | **Help-loop clarity** — asking and offering is the obvious main job | 🟧 Decision band ("Needs your response") and the warm Request Wizard are right; but below the band the feed is an **infinite column**, the card leads with **match %** over the ask, and `generic`/payload labels read technical. | No finite-queue boundary ("you're caught up"); inverted card hierarchy (person+score over relationship+task); mobile FAB overlaps the "Offer to Help" CTA. | A **finite, relationship-led** loop: lead with the relationship reason + the ask; quiet match signal; clear empty/“caught up” states; impression logging on `view=home`/`view=community`. | **S88** (help-loop redesign) |
| 3 | **Privacy & forgetting** — trust fades; data is private by default; "designed to forget" | 🟥 Karma is private-by-default (good) but **forgetting is invisible to the member** — no profile surface shows what's fading; the public landing page tells this story, the app does not. | The decay/forgetting promise lives only in ranking math; the member's own profile frames karma around "stay engaged", not memory that fades. | A member-facing **"what's fading"** surface (recent interactions weigh more; old ones quietly recede); privacy/visibility legible at the point of sharing. | **S90** (trust/forgetting/profile); seeded small S88 |
| 4 | **Meaning, not points** — relationships and contribution over scores/accounting | 🟥 Scores lead everywhere: per-card **match %**, per-person **`⭐ KarmaBadge`**, governance **trust/karma/threshold** numbers, empty community **KPI tiles**, and literal **"stay engaged"** copy. | "Accounting outranks meaning" is the dominant pattern; the humane contribution story (who you helped, the reasons you're connected) is subordinated to numbers. | Relationship reason (`TrustPathBadge`/"via X") leads; per-person scores removed; match% de-emphasized; contribution shown as story, not a tally; no engagement language. | **S88** (card: KarmaBadge removal, %-demote) → **S89/S90** (governance/profile meaning) |
| 5 | **Local trust** — trust is relational, path-based, and warm | 🟧 `TrustPathBadge` ("Fellow member via Raj Okafor" / "Direct connection") exists and is the right primitive; Trust Graph has warm copy. But the badge sits **under the score**, the graph is a dense academic node-link diagram, and trust UI uses **off-palette** dark/indigo panels. | The relationship path is present but not the lead; trust visualization is high-cognitive-load and visually inconsistent with warm-commons. | Relationship path is the **first thing** on every card; trust shown as legible "how you're connected", one warm palette; living/fading edges. | **S88** (promote path on card) → **S90** (trust/profile depth) |

---

## How to read the scorecard across the arc

- **S88** moves promises **2, 4, 5** materially (the help loop is the proof point: card hierarchy,
  KarmaBadge removal, %-demote, finite queue, relationship-led).
- **S89** owns promise **1** (community sovereignty: member-home altitude, fission/fusion).
- **S90** owns promise **3** and deepens **5** (forgetting/profile/trust).
- **S91** carries the polished web model to **mobile**; **S92** prunes architecture (no promise on the
  user surface, but removes the feed-service/cleanup-service drift that makes "source of truth" murky).

Every row above has a **current** state, a **target** state, and an **owning sprint** — this table is the
acceptance rubric each of S88–S92 is checked against at its own pre-merge gate.
