# Interaction Half-Life

> **The transaction fades. The relationship endures.**

Every time you exchange help with someone on Karmyq, you strengthen a trust edge between you. But trust isn't a static number — it has a half-life. Connections that go quiet gradually fade. Connections that stay active grow stronger and last longer.

---

## What Is Interaction Half-Life?

Interaction half-life is the time it takes for a trust connection to decay to half its current strength, assuming no new interactions.

By default, a single exchange has a half-life of **30 days**. After 30 days of silence, the connection is half as strong. After 90 days, it's below the visibility threshold and will eventually be removed.

But here's the key: each new exchange **extends** the half-life of the connection. Repeat interactions don't just add weight — they add *stability*. A relationship with five exchanges has a half-life of over 60 days. One with twenty exchanges has a half-life measured in years.

---

## How Stability Works

Each trust connection has a hidden `stability` value that starts at 1.0. Every time you interact with someone:

1. The interaction is counted and contributes to the raw trust weight
2. The stability score grows: `stability = stability × 1.20` (20% per interaction, by default)
3. A higher stability means a longer effective half-life: `effective_half_life = stability × base_half_life`

| Interactions | Stability | Effective half-life |
|---|---|---|
| 1 | 1.0 | 30 days |
| 5 | ~2.1 | ~62 days |
| 10 | ~5.2 | ~155 days |
| 20 | ~38 | ~957 days |

A relationship built on twenty exchanges is effectively permanent — it would take nearly a decade of silence to fade away.

---

## What the Fading UI Means

### In the Trust Graph

Edges in your trust graph fade in opacity as they decay. A bright, fully opaque edge means a recently active relationship. A faint edge means the connection exists but hasn't been reinforced recently.

The opacity formula: `opacity = 0.2 + (current_weight / raw_weight) × 0.8`

- A fresh connection (just interacted): full opacity (1.0)
- A connection that's halfway to its half-life: ~0.6 opacity
- A nearly-faded connection: 0.2 opacity (minimum visible)

**Reading edge opacity:** If you see many faint edges in your trust graph, it means those relationships are going quiet. Completing another exchange will instantly re-brighten the edge.

### In the Request Feed

Completed requests that are approaching their 30-day deletion window will appear increasingly faded in the feed. This is a visual signal that the transaction history is being archived — but the trust relationship it created lives on.

---

## What Happens at 30 Days (Request Deletion)

Completed, fully-rated requests are permanently deleted 30 days after completion. This is intentional:

- The **transaction** is ephemeral. Once rated, it has served its purpose.
- The **relationship** is durable. The trust edge it created — with its accumulated stability and raw weight — persists and continues to decay on its own biological clock.

What is preserved: the trust edge's `raw_weight` and `stability`. What is deleted: the original request text, descriptions, and match records.

This keeps the platform lightweight and focused on active mutual aid, not historical record-keeping.

---

## How Your Community Configures It

Community admins can tune the decay parameters for their community via the admin panel or the decay config API:

- **Base half-life** (default: 30 days): How quickly a single interaction fades
- **Stability growth rate** (default: 20%): How much each interaction extends the half-life
- **Disappearance threshold** (default: 0.5): The weight below which a connection is swept away

Communities with faster social cycles (high-activity neighborhood groups) may prefer shorter half-lives. Communities with slower rhythms (regional networks, professional associations) may prefer longer ones.

---

## Summary

- Trust connections are alive — they decay when dormant, strengthen when active
- Each new interaction extends the connection's half-life (stability effect)
- Fading edges in the trust graph are a signal, not a problem
- Completed requests are deleted after 30 days; the relationship they created is not
- The platform cleans up dead edges automatically via a nightly sweep job
