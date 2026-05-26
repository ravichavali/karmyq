# Trust-Gated Governance

karmyq communities don't have permanent admin roles. Governance authority is earned through trust and can be lost if trust drops — an architectural commitment against oligarchic lock-in.

## How It Works

**Eligibility** is based on trust score. A community sets an eligibility threshold (default: 50). Any member whose trust score meets the threshold is eligible to hold a governance role.

**Nomination** is open to all active members. Any member can nominate an eligible member for Admin or Moderator.

**Ratification** requires quorum. A configurable number of current role-holders must ratify a nomination before it takes effect. When quorum is reached, the role is granted automatically.

**Rotation** is triggered by trust drops. If a role-holder's trust score falls below the threshold, their role becomes eligible for reassignment. There is no time-based expiry — only trust-based.

## Community Maturity

New communities start in **Constrained** governance mode: limited configuration rights, invite-only membership decisions. As the community's average trust score grows above the eligibility threshold, it transitions to **Mature** mode with full governance rights.

This prevents governance capture by communities that haven't built real trust yet.

## Governance Templates

- **small-collective** (default): 3-member quorum, flat authority — good for small groups
- **council**: 5-member quorum, role specialization (admin/moderator) — good for medium communities
- **open-delegation**: trust-weighted voting on governance decisions — good for large, mature communities

## Why Non-Permanent Roles?

Permanent roles create oligarchies. A founding admin who has become inactive retains authority indefinitely under static systems. karmyq's governance reflects where you stand *now* in the community's trust network — not who you were when the community was founded.

See [ADR-055: Trust-Based Governance Architecture](/docs/concepts/adr-055-trust-governance-architecture) for the full design rationale.
