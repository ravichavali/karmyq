# Sprint 70: Plan in Next Chat 🔲

## Handoff Document

**Date**: 2026-05-28
**Current Version**: v9.90.0 (Sprint 69 + post-sprint fixes shipped)
**Status**: Sprint 69 fully complete and deployed. Several post-sprint bugs fixed this session. Sprint 70 to be planned in the next conversation.

---

## Quick Start

1. Read this handoff
2. Run `/sprint-planning` to plan Sprint 70 (Fusion Mechanism)
3. The arc context and carry-forward items below are the key inputs

---

## What Was Completed This Session (post-Sprint 69 fixes)

All committed and deployed to karmyq.com via GitHub Actions.

### Graph UX Fixes (`TrustGraph.tsx`)
- `fgData` memoized with `useMemo` — force simulation no longer restarts when parent re-renders (was the root cause of "flakiness")
- Selection dimming removed in `groupMap` mode — group colors (blue/orange) always visible, selected node gets an amber ring instead
- Zoom/pan re-enabled after over-correction (was fully disabled, now only node drag is disabled in fission mode)
- Graph width tracks container via `ResizeObserver` (was hardcoded 700px)

### Governance Fix (`governance.ts`)
- Ratify endpoint now requires **active membership** (was incorrectly requiring admin/moderator role — blocked Wei Zhang's ratification of Priya's elevation)
- Self-ratification blocked: nominated person cannot ratify their own nomination
- UI: Ratify button replaced with "your nomination" / "✓ Ratified" states based on `currentUserId`
- `GovernanceTab` now receives `currentUserId` prop

### Fission Vote Fixes (`splits.ts`, `FissionTab.tsx`)
- GET `/splits/:splitId` now returns `my_vote` (current user's choice) — vote buttons correctly hidden after page refresh
- `FissionTab` seeds `myVote` from server on every `fetchDetail()` call

### Vote-Opened Notifications (`splits.ts`, `subscriber.ts`, `notificationTemplates.ts`)
- `start-vote` route publishes `split_vote_started` event (non-blocking)
- Notification service handles it: notifies all active community members with in-app + push, links to fission tab
- `split_vote_started` added to `NotificationType` union and template registry

---

## Open Design Questions (noted for future sprints)

### Ratification Quorum
With any active member able to ratify, the default quorum of 3 is trivially easy to hit in communities with 20+ members. Options to revisit:
- Trust-gated ratification (only members above `eligibility_threshold`)
- Weighted quorum (trust-score-weighted, like the split vote)
- Higher quorum defaults (5–7, or % of eligible members)

### Graph Polish Sprint (deferred)
Two surfaces flagged for a dedicated polish sprint:
- **TrustGraphTab (ego-network)**: user wants more polish, specific issues TBD at sprint time
- **Fission graph**: force-directed is a poor fit for "which group" view — bipartite SVG layout (two columns, trust arcs between them) would be better
Start with a layout audit + reference products before any implementation.

---

## v10.0 Trust Network Arc

| Sprint | Theme | Status |
|--------|-------|--------|
| **65** | Trust Graph Foundation | ✅ Shipped v9.50.0 |
| **66** | Trust Graph Visualization + Governance ADR | ✅ Shipped v9.60.0 |
| **67** | Ego-Network + Governance | ✅ Shipped v9.70.0 |
| **68** | Interaction Half-Life (Ebbinghaus decay) | ✅ Shipped v9.80.0 |
| **69** | Fission Mechanism | ✅ Shipped v9.90.0 |
| **70** | Fusion Mechanism | 🔲 Next sprint |
| **71** | v10.0 Polish + karmyq.org update | 🔲 Planned |

---

## Sprint 70 Context (Fusion)

The counterpart to fission — two communities merge into one. Governed by the same trust-weighted vote pattern as fission. Key design questions to discuss in planning:
- Who can propose a fusion? (both admins? one admin + member vote?)
- What happens to trust edges across the two communities after merge?
- Does the merged community inherit both communities' karma records?
- What `community_link` type does this produce? (`fusion_origin`?)
- How does the community_link sprint-15 schema support this? (it has `link_type` + `trust_carry_factor`)

ADR-018 (community splitting mechanics) covers fission. Fusion likely needs its own ADR or an extension — worth discussing at planning time.

---

## Architecture Gotchas (Persistent)

- **Landing page docs**: `apps/landing/src/data/docs/` is in `.gitignore` — always `git add -f`
- **ADR numbering**: Next ADR is **057** (verify with `ls docs/adr/ | sort | tail -5`)
- **TDD test placement**: Community tests in `services/community-service/tests/tdd/`
- **JWT field** is `communities` not `communityMemberships` — always `user.communities ?? []`
- **`git add` on CLAUDE.md**: Tracked as lowercase `claude.md` — always `git add claude.md`
- **Pre-existing TDD failures**: `sprint-39-provider-ux` (7 fail), `sprint-43-feed-ranking` (crashes), `sprint-68-halflife` (6 DB connection tests). Do NOT fix.
- **Solo dev — no worktrees**: Work directly on feature branches
- **nav.json revert bug**: `generate-docs.ts` regenerates nav.json on every build — always add new slugs to the hardcoded list in `scripts/generate-docs.ts`
- **trust_edges_live is a VIEW**: Never INSERT/UPDATE it. Use `trust_edges` for writes, `trust_edges_live` for reads
- **`trust_edges_live` column**: exposes `current_weight` (not `effective_weight`) — use `current_weight AS effective_weight` alias when querying
- **API response unwrap**: `createApiClient` interceptor already unwraps envelope — use `res.data`, not `res.data.data`
