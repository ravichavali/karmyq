# Metrics for Connection, Not Evaluation

**Date**: 2026-01-09
**Status**: Core Design Principle
**Related**: [Fractal Karma & Trust](FRACTAL_KARMA_TRUST.md)

## Core Principle

> "The main concept is to make sure that we need to make the connection happen."

Metrics should **enable people to connect** with strangers, not **evaluate their worthiness**.

---

## Metrics That Enable Connection ✅

These help people decide "Should I help this stranger?"

### 1. Trust Paths
**What**: "You → Sarah → Maria" (2° connection)
**Purpose**: Inherit trust through known relationships
**Enables**: "I trust Sarah, Sarah trusts Maria, so I can start with baseline trust for Maria"
**Display**: Always visible on requests/offers

### 2. Invite Paths
**What**: "Invited by Sarah" or "Invited: Maria, James, Lisa"
**Purpose**: Accountability through vouching
**Enables**: "I know who brought them here and who they brought"
**Display**: Public profile (with privacy controls)

### 3. Completion Rate
**What**: "92% of matches completed successfully"
**Purpose**: Functional reliability indicator
**Enables**: "They follow through on commitments"
**Display**: Public, always visible

### 4. Community Tenure
**What**: "Member for 8 months"
**Purpose**: Time-based trust signal
**Enables**: "They've been around, not a drive-by user"
**Display**: Public, always visible

---

## Metrics That DON'T Enable Connection ❌

These create hierarchy, competition, or judgment.

### 1. Karma Score
**What**: "150 karma points"
**Why NOT**: Number without context, creates ranking/comparison
**Alternative**: Private only, for self-awareness
**Decision**: ✅ Keep private, opt-in display only

### 2. Leaderboards
**What**: "Top 10 helpers in Portland Tools"
**Why NOT**: Creates competition, status anxiety, hierarchy
**Alternative**: Community aggregate stats (not rankings)
**Decision**: ✅ Never build leaderboards

### 3. Karma During Matches
**What**: "You'll earn 10 karma for helping"
**Why NOT**: Makes helping transactional, extrinsic motivation
**Alternative**: Keep action pure, show karma later (if user opts in)
**Decision**: ✅ No karma display during match flow

### 4. Karma Requirements
**What**: "Must have 50 karma to post requests"
**Why NOT**: Creates barriers, punishes new/quiet members
**Alternative**: Use completion rate for functional decisions
**Decision**: ✅ Karma never affects privileges

### 5. Karma Milestones
**What**: "🎉 You've reached 100 karma!"
**Why NOT**: Gamifies contribution, creates pressure for next milestone
**Alternative**: Simple completion count ("5 matches completed")
**Decision**: ✅ No milestones at launch, maybe later

---

## Design Decisions Summary

| Feature | Decision | Reasoning |
|---------|----------|-----------|
| Show karma during matches? | ❌ No | Keep action pure, not transactional |
| Karma affects privileges? | ❌ No | Purely informational, not functional |
| Karma milestones/badges? | ❌ Not at launch | Avoid gamification pressure |
| Show others' karma scores? | ❌ No | Show completion rate instead |
| Emphasize trust paths? | ✅ Yes | Enables connection through relationships |
| Emphasize invite paths? | ✅ Yes | Shows accountability and network |
| Show completion rate? | ✅ Yes | Functional reliability indicator |

---

## What Users See When Deciding to Help

**On Request Card**:
```
┌─────────────────────────────────┐
│ Need help moving couch          │
│ Saturday 2pm, 30 min            │
│ Maria Garcia                    │
│                                 │
│ Connection:                     │
│ • 2° via Sarah                  │
│ • Invited by Sarah              │
│                                 │
│ Track Record:                   │
│ • 92% completion rate           │
│ • Member for 5 months           │
│ • 8 successful matches          │
│                                 │
│ [Offer to Help]                 │
└─────────────────────────────────┘
```

**What's NOT shown**:
- ❌ Maria's karma score
- ❌ Maria's rank in community
- ❌ "Earn 10 karma if you help!"
- ❌ Maria's milestone badges

---

## The Philosophy

### Connection-Enabling Metrics Answer:
- "How are we connected?" (Trust path)
- "Who vouched for them?" (Invite path)
- "Do they follow through?" (Completion rate)
- "Are they established here?" (Tenure)

### Evaluation Metrics Answer:
- "How much have they contributed?" (Karma - private)
- "How do they rank?" (Leaderboard - never)
- "What badges do they have?" (Milestones - not at launch)

**We show the first group publicly.**
**We keep the second group private or don't build it.**

---

## Karma's Role (Clarified)

**Private Self-Reflection Only**:
- You see YOUR karma (if you opt in)
- Purpose: Self-awareness ("Am I helping as much as I'd like?")
- Trend: Growing/stable/declining (encouragement)
- Recent activity: "5 helps this month" (concrete)

**Never Used For**:
- ❌ Evaluating others
- ❌ Granting privileges
- ❌ Displaying publicly
- ❌ Competitive comparison

---

## Community Metrics (Future)

When we show **community** karma, it's aggregate:

```
Portland Tools Community
────────────────────────
52 matches completed this month
89% completion rate
Growing trend

(Not: "Ranked #4 out of 50 communities")
```

**Purpose**: Collective celebration, not competition

---

## Implementation Impact

### Backend (Already Done) ✅
- `/reputation/me/karma` - authenticated, private
- Returns: karma, trend, recent activity
- **Correct**: Only you can see your karma

### Frontend (TODO)
- **Profile page**: Show karma only if user enables it
- **Settings**: Opt-in toggle (default: OFF)
- **Request cards**: Show trust path, completion rate, tenure
- **NO karma anywhere in match flow**

### What NOT to Build
- ❌ Public karma displays
- ❌ Leaderboards
- ❌ Karma during match actions
- ❌ Milestone celebrations (not at launch)
- ❌ Karma-based privileges

---

## Related Documents

- [Fractal Karma & Trust](FRACTAL_KARMA_TRUST.md) - Overall philosophy
- [Minimal Karma Measurement](../backlog/MINIMAL_KARMA_MEASUREMENT.md) - Implementation plan
- [ADR-020: Trust-First Design](../adr/ADR-020-trust-first-design.md) - Design philosophy

---

**Bottom Line**: If a metric helps strangers connect, show it. If it evaluates worthiness, keep it private or don't build it.
