# ADR-075: karmyq.org Multi-Route Relaunch

**Status**: Accepted

## Context

`karmyq.org` is the public commons surface (per [ADR-065](ADR-065-karmyq-org-and-com-domain-roles.md)):
manifesto, principles, mechanics, research, and the founding-circle invitation. Until Sprint 95
all of that lived on a single long landing page. One page asked to do too much — story, principles,
mechanics, research, and invitation all competed for the same scroll — which made the site harder to
read, harder to share, and harder to review.

Three constraints shaped the decision:

1. `apps/landing` is a Next.js static export (`output: 'export'`). It cannot host Next API routes,
   so any backend-backed intake is out of scope for a static relaunch.
2. A set of v5 content drafts existed as standalone HTML files. They are the **content and
   organization** source of truth, but not the visual one — the live Tailwind/Fraunces design system
   remains authoritative. This is an information-architecture change, not a redesign.
3. `/docs` (generated technical documentation) must stay unchanged and reachable from every page.

## Decision

Split the public commons into **five static routes**, each carrying one reader intention:

| Route | Purpose |
|---|---|
| `/` | Story and founding narrative only (founder note included) |
| `/principles` | The six platform principles |
| `/how-it-works` | Mechanics + design essays |
| `/research` | The research foundation (eleven thinkers) |
| `/join` | Founding-circle invitation |

Supporting decisions:

- Route metadata, nav, and copy are extracted into pure TypeScript modules
  (`landingRoutes.ts`, `landingContent.ts`) so the existing pure-`.test.ts` Jest harness can
  regression-lock the information architecture without adding a React/jsdom stack.
- Every page shares one route-aware header (desktop + mobile loop) and footer. `Join the circle` is
  the single CTA button — never duplicated as a plain nav item. `/docs` stays in the nav, unchanged.
- The two reputation essays are merged into one, **"The Problem with Stars"**; "In Defense of Gossip"
  survives only as an internal section heading. A new governance essay, **"Why No Role Is
  Permanent,"** is added.
- `/join` keeps an encoded `mailto:contact@karmyq.org` submission path with a visible, copyable
  fallback address, and is laid out form-shaped (lens / contribution / concern / email) so Sprint 96
  can wire the same fields to a backend without restructuring the route.

### Sprint 96 intake boundary

Sprint 95 deliberately creates **no** database table or API endpoint for join submissions. Backend-
backed founding-circle intake (public endpoint, persistence, validation, spam/rate controls,
success/error UI) is owned by Sprint 96. The mailto + visible contact fallback remains the only
active submission mechanism until then.

## Consequences

### Positive

- One idea per route: easier to read, deep-link, and share; each page is independently reviewable.
- The information architecture is regression-tested as data, so nav/route/copy drift fails CI.
- Mechanics and governance essays are honest about how the system behaves (acts are never broadcast;
  fission/fusion are member-initiated, never automatic).
- `/join` is ready for a backend swap in Sprint 96 with no structural rewrite.

### Negative

- Five pages make the mobile hamburger a primary navigation surface; mobile nav must be validated
  on every deploy.
- Static export still cannot accept form submissions, so founding-circle intake stays manual until
  Sprint 96.

## Alternatives Considered

### Keep the single long landing page

Rejected. It was the problem being solved — competing intentions on one scroll, hard to share or
review.

### Adopt the v5 standalone CSS/visual system wholesale

Rejected. The live Tailwind/Fraunces design system is the visual source of truth; pasting the v5
essay CSS would have been an unscoped redesign. The v5 files informed content and structure only.

### Ship backend intake in the same sprint

Rejected. A static export cannot host the endpoint, and the intake surface (persistence, validation,
spam controls) is large enough to own its own sprint. Deferred to Sprint 96.
