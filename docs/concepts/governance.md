# Trust-Gated Governance

Karmyq combines trust-based eligibility for leadership with equal member votes on nominations. A higher trust score does not give someone a heavier ratification vote.

## How It Works

**Eligibility** is based on trust score. A community sets an eligibility threshold (default: 50). Any member whose trust score meets the threshold is eligible to hold a governance role.

**Nomination** is open to active members. The nominee must also be active and meet the community's eligibility threshold. Members may be nominated for Moderator or Admin; moderators may be elevated to Admin. Ratification does not demote an admin or grant a role someone already holds.

**Ratification** uses equal votes from the nomination's original active members, excluding the nominee. The required number is **20% of those voters, rounded up, with a minimum of three**. It is fixed when the nomination opens.

| Original voters other than the nominee | Required ratifications |
|---|---|
| 10 | 3 |
| 50 | 10 |
| 149 | 30 |

There must be at least three voters besides the nominee to open a nomination. Nomination adds no automatic vote; a nominator can ratify separately. The nominee cannot ratify their own nomination.

New arrivals cannot vote on an already-open nomination. Departed members' votes stop counting, while the required number stays fixed. If a steward reactivates an original member, their existing vote counts again. Self-service rejoin does not currently reactivate an inactive membership; ask a steward.

If restored votes already satisfy quorum, a prior active voter can select **Finalize decision**. This safely rechecks the existing votes and nominee eligibility without adding another ballot. Reading the decision never grants a role by itself.

At quorum, Karmyq rechecks that the nominee is still active, eligible and being elevated, then grants the role and closes the nomination together. A completed grant is not undone by later voter departures. A nomination that loses too many voters can remain pending; this change adds no expiry or withdrawal control.

**Transition:** nominations pending under the old fixed-quorum rules close during the migration and must be submitted again. Already granted roles and historical ballots remain.

## Community Maturity

The governance screen labels the community **Constrained** or **Mature** from its aggregate relationship weight and configured eligibility threshold. Personal trust values remain private. This nomination change does not introduce a maturity-based voting gate.

## Split Governance

When a community splits, the two child communities stay related through a `split_origin` link. That
link carries lineage and cross-group trust context; it does not mean the same parent admin governs
both children by default.

Each child receives an admin from its own assigned members. If the executing admin is assigned to a
child, they can administer that child. If they are not assigned to the sibling child, Karmyq selects
an admin from the sibling's assigned members so authority follows the people who actually moved
there.

## Governance Templates

Existing template labels can describe a community's governance style. New admin/moderator nominations all use the proportional rule above; a legacy `quorum_size` value does not override it. Trust-weighted delegation remains an architectural direction rather than this ratification mechanism.

## Why Non-Permanent Roles?

Avoiding permanent privilege is an architectural goal. This sprint implements nomination eligibility and ratification; it does not add automatic role rotation, revocation on a trust drop, or time-based expiry. Those intentions must not be read as promises made by the current voting controls.

See [ADR-055: Trust-Based Governance Architecture](/docs/concepts/adr-055-trust-governance-architecture) for the full design rationale.
