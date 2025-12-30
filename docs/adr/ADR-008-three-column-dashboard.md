# ADR-008: 3-Column Dashboard Layout (V7)

**Date**: 2025-12-29
**Status**: Superseded by ADR-005 (Minimalist Dashboard)
**Deciders**: Development Team
**Related**: docs/architecture/V7_UI_ARCHITECTURE.md, ADR-005

## Context

V7.0 introduced a complete UI overhaul focusing on information density and social engagement.

## Decision

**3-column layout inspired by Twitter/X and LinkedIn:**
- **Left Sidebar (25%)**: User profile, karma, trust score, community selector
- **Center Feed (50%)**: Quick create, milestones, feed posts, requests, inline chat
- **Right Sidebar (25%)**: Community health, recent milestones, top helpers

**Responsive:**
- Desktop (≥1024px): Full 3-column
- Mobile (<1024px): Single column (center feed only)
- Sticky sidebars on desktop

## Why Superseded

User feedback preferred **minimalist, action-focused design** over information-dense layout:
- 3-column was overwhelming on smaller screens
- Cognitive load too high
- Mobile-first approach better for target users
- **V8.0 adopted minimalist dashboard (ADR-005)**

## Historical Value

V7 architecture teaches important lessons:
- Information density has limits
- Mobile-first > desktop-first for mutual aid
- Action-oriented > stats-oriented
- Progressive disclosure > show everything

## References

- V7 Architecture: `docs/architecture/V7_UI_ARCHITECTURE.md`
- Current design: ADR-005 (Minimalist Dashboard Design)
- User feedback: "Preferred compact design"
