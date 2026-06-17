# Splitting a Community

> **Healthy communities know when to divide.**

Communities thrive at the scale of trust. As membership grows past the Dunbar number (~150), relationships become diluted, mutual aid becomes transactional, and the sense of shared purpose fades. When a community is ready to split, Karmyq provides a four-stage governed process to do it well.

---

## Why Communities Split

A community split isn't a failure — it's a sign of success. When a community has grown large enough to develop distinct subgroups with strong internal trust, a split can:

- **Restore intimacy**: Smaller communities have deeper member relationships
- **Clarify purpose**: Each child community can specialize its mission
- **Preserve trust**: The trust graph guides the split — members who trust each other most stay together
- **Maintain history**: The parent community is preserved with all historical records intact

---

## Stage 1: The Size Alert

When your community approaches its optimal size, Karmyq surfaces an alert at the top of the community page:

| Members | Alert |
|---|---|
| 120+ | "Community growing — consider watching this space" |
| 130+ | "Approaching optimal size. A split may help maintain trust." |
| 140+ | "⚠️ Consider splitting to maintain cohesion." |

Admins see a **Propose Split →** link in the alert. All members see the alert (but only admins can propose).

---

## Stage 2: Proposing a Split (Admin Only)

1. Open the **Split** tab from the community navigation.
2. Click **Create Split Proposal**.
3. Fill in:
   - **Name for Group A** — the name for the first child community
   - **Name for Group B** — the name for the second child community
   - **Rationale** — why now? What natural division exists?
4. Submit.

**What happens next:** The system runs a trust-graph clustering algorithm to suggest which members belong in each group. Members who trust each other more end up in the same group. You don't have to figure out the groupings from scratch.

---

## Stage 3: Reviewing Assignments (Admin)

After the proposal is created, the **Split** tab shows the member assignment table:

- Each member is listed with the **algorithm's suggestion** and their **current assignment**
- Rows highlighted in amber are where your assignment differs from the algorithm's suggestion
- Use the **Move to** button to toggle any member between Group A and Group B
- The summary row shows the count in each group

**Opening the vote:** Once every member is assigned (no "Unassigned" members remain), click **Open Voting**. This transitions the proposal from discussion to the voting phase.

---

## Stage 4: Voting (All Members)

Once voting opens, all active members can see the **Split** tab and vote:

- **Yes — Split**: In favor of the split as proposed
- **No — Stay Together**: Against the split
- **Abstain**: Neutral

Vote weight is **prestige-weighted** — members with deeper trust relationships in this community carry more weight in the vote. This prevents newcomers from having disproportionate influence over a community's structure.

**Thresholds:** By default, the proposal passes if:
- At least **60% of members vote** (quorum)
- At least **60% of weighted votes are Yes** (approval)

If both thresholds are met, the proposal automatically moves to **Approved**.

---

## Stage 5: Executing the Split (Admin)

Once the proposal is approved, the admin sees an **Execute Split** button.

Executing the split is **atomic** — all of the following happen in a single transaction:

1. Two new communities are created (Group A and Group B)
2. Each member is added to their assigned child community
3. Each child gets an admin selected from that child's assigned members
4. A `split_origin` link is created between the two siblings — their trust carry-over factor is set to 0.40 (members who land in different communities retain 40% of their cross-group trust)
5. The parent community is marked `status = 'split'` — it is **not deleted**
6. The proposal is marked `executed`

Admin authority is child-local after execution. The executing parent admin governs a child only if
they were assigned to that child. If they are assigned to just one child, the sibling child receives
an assigned parent admin if one is present there; otherwise Karmyq promotes the strongest assigned
member by within-child trust degree, with deterministic `joined_at` and user-id tie-breaks.

---

## After the Split

- **Both child communities are immediately active.** Members can post and fulfill requests right away.
- **Each child has its own admin.** The `split_origin` link preserves sibling relationship and trust
  carry-over; it does not create shared admin authority across both children.
- **The parent community remains.** All historical karma records, help requests, and trust history reference the parent ID. You can visit it to see the full history of the community before the split.
- **Cross-group trust persists at 40%.** Members who ended up in different communities still have trust connections — just slightly weaker. These may strengthen again through inter-community collaboration.
- **A second split is currently a one-per-community feature.** After execution, the constraint prevents a second formal split proposal. This is a demo-scope limitation.

---

## FAQ

**Can I change my vote?**
Yes — casting a new vote overwrites your previous one.

**What if voting expires without reaching quorum?**
The proposal remains in `voting` status. A future version will auto-reject after the deadline.

**Can a member refuse to be assigned?**
Not in the current version. Assignment is determined by the admin (informed by the algorithm). Members can make their preferences known to the admin before the vote.

**Can the parent community be used after the split?**
The parent is marked `split` and no longer receives new requests. It's an archive of the community's history.
