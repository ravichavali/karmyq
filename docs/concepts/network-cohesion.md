# Network Cohesion

Is your community a tight-knit web where everyone helps everyone, or are a few people doing all the work?

Network Cohesion answers that question. It's a score from 0 to 100 that measures the structural health of your community's helping relationships — not just whether people are active, but whether those interactions form a genuinely mutual network.

---

## What It Means in Plain Language

Imagine your community as a map of connections. Every time one member helps another, a line appears between them. Network Cohesion looks at the shape of those lines:

- **Are they two-way?** Does Alice help Bob *and* Bob help Alice, or is it always one-directional?
- **Are they spread out?** Is help flowing across the whole community, or just through a small inner circle?
- **Do they form clusters?** Do Alice's helpers also help each other, creating tight supportive sub-groups?
- **Can help reach everyone quickly?** Or are some members only reachable through long chains?

A community with a high cohesion score is resilient. Help doesn't depend on any single person. New members get woven into the network. If a key member leaves, the community doesn't collapse.

A community with a low cohesion score may look active on the surface but have hidden fragilities — a few people carrying everything, or isolated pockets that rarely interact.

---

## The Five Labels

Network Cohesion is displayed as a label alongside the numeric score in the community admin Stats tab.

| Score | Label | What It Means |
|-------|-------|---------------|
| 80–100 | **Highly Cohesive** | Mutual, dense, well-connected helping network. Help flows freely between members. |
| 60–79 | **Cohesive** | Solid network structure with good reciprocity and clustering. A healthy, functioning mutual aid community. |
| 40–59 | **Developing** | The network is forming but has gaps — some members are not yet well connected, or reciprocity is one-sided. |
| 20–39 | **Emerging** | Early-stage structure. A few connections exist but the community is not yet functioning as a mutual aid network. |
| 0–19 | **Fragile** | Very sparse or one-directional. The community may look active but lacks the structural support to sustain itself. |

---

## How Each Metric Is Computed

The score is calculated over a **rolling 90-day window** — it reflects the current, living state of your community, not its entire history.

### Reciprocity (30% of score)

**Question**: Does help flow both ways between members?

Reciprocity counts the fraction of member pairs where help has gone *both directions*. If Alice helped Bob and Bob also helped Alice in the past 90 days, that pair is reciprocal.

```
Reciprocity = (number of reciprocal pairs) / (total distinct helping pairs)
```

A reciprocity of 1.0 means every helping relationship is mutual. A reciprocity of 0.1 means most help is one-directional — more like charity than mutual aid.

This metric carries the most weight (30%) because genuine mutual aid is the core of what Karmyq is trying to build.

### Density (20% of score)

**Question**: How broadly is help distributed across the community?

Density measures what fraction of all *possible* connections between members are actually realized.

```
Density = (actual helping pairs) / (N × (N - 1))
```

where N is the number of active members in the window.

High density means everyone is involved. Low density means a clique is doing all the work.

### Clustering Coefficient (30% of score)

**Question**: Do your helpers also help each other?

The clustering coefficient measures whether a member's helpers form a tight-knit group among themselves. High clustering means the community has many overlapping supportive relationships — the hallmark of strong social capital.

```
For each member with at least 2 connections:
  local_cc = (triangles through that member) / (possible triangles)

ClusteringCC = average local_cc across all qualifying members
```

### Path Score (20% of score)

**Question**: How quickly can support spread to any member?

Path Score measures the average number of steps needed to reach any member from any other member through the helping network. Shorter paths mean support can spread quickly.

```
PathScore = 1 / avg_path_length   (capped at 1.0)
```

---

## The Weighted Formula

```
score = round(
  (Reciprocity × 0.30 + Density × 0.20 + ClusteringCC × 0.30 + PathScore × 0.20)
  × 100
)
```

Each metric is a value between 0 and 1. The weighted average is multiplied by 100 and rounded to produce a score from 0 to 100.

---

## Connection to Social Capital Theory

Network Cohesion is grounded in social science research on how communities build and sustain collective capacity.

**Robert Putnam's bonding and bridging capital** (*Bowling Alone*, 2000) distinguishes between *bonding* capital — tight relationships within a group — and *bridging* capital — connections that span across different groups. The clustering coefficient and reciprocity metrics capture bonding capital. Density and path length capture bridging capital. A healthy community needs both.

**Small-world network theory** (Watts & Strogatz, 1998) showed that the most efficient and resilient networks combine high clustering (tight local groups) with short average path lengths (fast global reach). This is exactly the combination Karmyq's formula rewards.

A community with a Highly Cohesive score has the structural properties that social science associates with communities capable of collective action, resilience, and sustained mutual support.

---

## Where Admins Can See It

The Network Cohesion score is displayed in the **community admin Stats tab**, alongside the Community Trust Score. Both scores update daily. Admins can see the current score, label, underlying metric values, active member count, and the date last calculated.

Use the cohesion score to spot structural problems early — before they become visible as member complaints or churn.
