# ADR-065: Karmyq.org and Karmyq.com Domain Roles

**Status**: Implemented

## Context

Karmyq now has two public surfaces that serve different audiences:

- `karmyq.org` — the public commons: manifesto, research, stories, architecture docs, and founding-circle invitations.
- `karmyq.com` — the working proof-of-concept platform where users can try the application.

The founding-circle relaunch needs `karmyq.org` to invite specialists into a small founding circle without pretending the proof-of-concept is a fully mature public product. Mixing the roles creates confusing CTAs, overstates readiness, and makes the public site harder to review.

## Decision

Treat `karmyq.org` as the narrative and governance-facing commons, and treat `karmyq.com` as the product proof-of-concept.

For the founding-circle launch:

- The primary `karmyq.org` CTA is to join the founding circle by contacting `contact@karmyq.org`.
- The `mailto:` flow must encode every user-provided field before placing it in the href.
- `contact@karmyq.org` remains visible and copyable as a fallback when mail clients or protocol handlers fail.
- Links to `karmyq.com` are secondary "try the PoC" links, not the main launch conversion.
- `karmyq.org` keeps docs and research available for reviewers who want to inspect the system before joining.

## Consequences

### Positive

- Launch copy can be honest about maturity while still inviting useful participation.
- Specialists, organizers, builders, and researchers get a clearer action than "start a community" too early.
- The `.org` site can carry civic/research/governance context while `.com` remains the app surface.
- Reviewers can audit mailto safety with a focused regression test.

### Negative

- The launch depends on manual email triage instead of a structured signup backend.
- Some visitors may miss the proof-of-concept if they expect the primary CTA to enter the app.
- Future marketing changes must preserve the domain distinction or intentionally supersede this ADR.

## Alternatives Considered

### Make `karmyq.com` the primary CTA

Rejected for this launch because the goal is founding-circle feedback, not broad product activation.

### Add a backend signup form

Deferred. A mailto flow is intentionally lightweight for this sprint, but it needs encoding and visible fallback safeguards.

### Keep `.org` manifesto-first

Rejected for launch timing. The manifesto remains available through site sections and docs, but the homepage now leads with a specific invitation.
