# Reading the Trust Graph

The trust graph turns your completed help exchanges into a picture. Each person you've built trust with is a **node**; each relationship is a **link**. Stronger, more recent relationships draw heavier lines. It's the platform's memory of who has actually shown up for whom.

## One number: the decayed trust score

A node's **trust score** is the sum of the *current* (decayed) strength of all its trust relationships. Trust that isn't maintained fades, so the score reflects where a relationship stands **today** — not its all-time peak. The same person therefore shows the **same score in every view**.

## One engine, one visual language

Every belonging-graph surface renders through a **single** engine (hierarchical edge bundling). There is no second graph idiom anywhere — what you learn on the dashboard reads the same on your profile, in a community, and in the full-page explorer. Across all of it:

- **Every node is the same size.** Node size doesn't encode a variable, so it can't mislead. What you read is *structure* — who clusters together, who bridges groups. (Community member counts live in the detail panel, not the dot.)
- **You are enlarged and white-ringed** — a "you are here" anchor. In the communities view, **your** communities carry an emerald member ring.
- **Your connections are amber.** Lines touching you stand out from everyone else's.
- **Clusters share a color.** Ties inside a close-knit group are indigo; ties that bridge between groups are slate. A cluster is a tightly-knit pocket of people, detected from the strongest ties.
- **Reputation numbers stay private.** Clicking another person shows only their name and connection count (which you can already see as edges). Trust score and karma appear only on your own node.
- **Hover or focus fades the rest.** Pointing at (or keyboard-focusing) a node dims everything not in its neighborhood, so one person's connections are legible inside a dense graph.

## The four modes

- **Ego** — your trust network: across one community (**My Network**), across all of them (dashboard → People, profile belonging section), or in the explorer with a depth slider.
- **Community** — every member of a community, grouped into clusters by how closely they connect.
- **Communities** — the inter-community depth view: each community is a node. **Organic ties** (solid, slate) accrue as members exchange help across communities; **fission lineage** (dashed, violet) traces parent→child links left behind when a community splits.
- **Fission** — a proposed split, colored by the proposed groups.

## Why expansion lives only in the full-page explorer

Most surfaces are a **static, complete** picture: a community view already shows the whole community, so there is nothing to expand. Progressive **click-to-expand** — pulling in a clicked person's neighborhood, up to three at a time — only makes sense for the open-ended **ego** view, where the graph starts small and you choose where to look further. So expansion is offered only at `/network?mode=ego`; everywhere else, activating a node just opens its detail.

## How relationships form and fade

Completing a help exchange strengthens a tie; endorsements, karma, and shared events also contribute. Without continued interaction, a tie's weight **decays** over time — which is why the trust score is the *decayed* current weight. Active trust is what counts.

## Fading bonds

Some lines look softer because Karmyq weights recent, tended relationships more than old ones. A fading
bond is still present — it has just been quieter lately. A nearly forgotten bond is close to leaving
active memory; helping each other again keeps it alive, or you can let it fade. The graph carries a
small **How memory fades** legend so this is readable in words, not only in line opacity.
