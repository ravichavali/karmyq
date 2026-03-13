# Moderator Role Model — Permission Matrix and Rationale

**Date**: 2026-03-13
**Status**: Accepted
**Sprint**: 25

---

## Overview

This spec defines the permission model for the `moderator` role within Karmyq communities. It establishes what moderators can and cannot do in the admin UI, and explains the design rationale behind the boundary between moderator and admin authority.

---

## Design Rationale

Moderators are the "close-knit, densely-connected active members" who help run day-to-day community operations. They are **trusted operators**, not configuration owners.

This distinction matters:

- **Admins** own the community's identity and structure — they control settings, linked communities, request TTLs, and membership composition (including who holds what role). These are decisions with long-term, hard-to-reverse consequences.
- **Moderators** keep the community running smoothly — they approve new members, triage requests, monitor health, and manage providers. These are routine operational actions that benefit from more hands.

Giving moderators access to Settings or role/membership management would blur accountability. If anything goes wrong with community configuration or composition, there should be a clear owner. That owner is the admin.

Moderators are empowered to act, not to reconfigure. The permission model reflects this by drawing the line exactly at the boundary between operations and governance.

---

## Permission Matrix

| Feature | Member | Moderator | Admin |
|---------|:------:|:---------:|:-----:|
| Overview tab | ✓ | ✓ | ✓ |
| Members tab — card view | ✓ | ✓ | ✓ |
| Members tab — Active/Pending filter | ✗ | ✓ | ✓ |
| Members — approve/reject pending | ✗ | ✓ | ✓ |
| Members — invite | ✗ | ✓ | ✓ |
| Members — change roles | ✗ | ✗ | ✓ |
| Members — remove members | ✗ | ✗ | ✓ |
| Pending badge on Members tab nav | ✗ | ✓ | ✓ |
| Norms tab | ✓ | ✓ | ✓ |
| Requests tab — view + triage + propose match | ✗ | ✓ | ✓ |
| Insights tab — stats & cohesion | ✗ | ✓ | ✓ |
| Insights tab — export data | ✗ | ✗ | ✓ |
| Settings tab (config, TTL, linked communities) | ✗ | ✗ | ✓ |
| Providers tab | ✗ | ✓ | ✓ |

---

## What Moderators CAN Do

Derived from the permission matrix above, moderators have access to the following capabilities:

- **View the Overview tab** — see community summary and activity at a glance
- **Browse the Members tab** — view member cards including the full Active/Pending filter
- **Approve or reject pending membership requests** — manage the membership queue
- **Invite new members** to the community
- **See the pending badge** on the Members tab nav indicator when members are awaiting approval
- **View the Norms tab** — read community norms alongside regular members
- **Access the Requests tab** — view open help requests, triage them, and propose matches between requesters and providers
- **Access the Insights tab** — view community health statistics and cohesion metrics
- **Access the Providers tab** — view and manage community providers

---

## What Moderators CANNOT Do

The following capabilities are **admin-only** and are explicitly out of scope for moderators:

- **Change member roles** — promoting a member to moderator or admin, or demoting any role, is a governance decision reserved for admins
- **Remove members** from the community — membership removal is a consequential action with potential trust and safety implications; only admins may do this
- **Access the Settings tab** — community configuration (request TTL, linked communities, community metadata) is owned entirely by admins
- **Export data** — bulk data export from the Insights tab is restricted to admins

These restrictions are intentional. Moderators are operational actors; the four capabilities above represent governance authority that must remain with the admin role.

---

## Migration Path

The `moderator` role already exists in the database (`community.members.role` column). No schema changes are required.

**On deploy**, existing moderators automatically gain the new UI capabilities defined in this spec. The permission checks are evaluated in the frontend based on the role value returned from the community membership API. Because the role value itself does not change (it remains `'moderator'`), no data migration or backfill is needed.

**Summary**:
- No DB migrations required
- No backfill scripts required
- Existing moderators receive expanded UI access immediately upon frontend deployment
- Admins retain all existing capabilities unchanged
- Members are unaffected

---

## Related Documents

- `docs/superpowers/specs/` — Sprint 25 spec series
- `services/community-service/CONTEXT.md` — community membership schema and role definitions
- `apps/frontend/.claude/README.md` — frontend permission gating patterns
