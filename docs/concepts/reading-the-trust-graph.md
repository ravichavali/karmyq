# Reading the Trust Graph

The trust graph turns your completed help exchanges into a picture. Each person you've built trust with is a **node**; each relationship is a **link**. Stronger, more recent relationships draw heavier lines. It's the platform's memory of who has actually shown up for whom.

## One number: the decayed trust score

A node's **trust score** is the sum of the *current* (decayed) strength of all its trust relationships. Trust that isn't maintained fades, so the score reflects where a relationship stands **today** — not its all-time peak. The same person therefore shows the **same score in every view**.

## One canonical graph, one canvas renderer, multiple homes

There is **one** canonical belonging graph — one data model, normalized once — drawn by **one** canvas renderer (`react-force-graph-2d`, ADR-083) across all of its homes: your **profile**, your **community**, and the full-page **`/network`** explorer. What you learn in one reads the same in the next. As of Sprint 114 the renderer is a force-directed canvas (it replaced the radial edge-bundle); the geometry looks different, but the meaning of every element is the same. The one deliberate variation is the *across-communities* scale, where the nodes are whole communities rather than people — your communities anchored near the centre, connected communities spread outward, always labelled. Across all of it:

- **Every *person* node is the same size.** A person's dot doesn't encode a variable, so it can't mislead. What you read is *structure* — who clusters together, who bridges groups. (The exception is a *community* node on the across-communities scale, whose size honestly encodes membership.)
- **You are enlarged and white-ringed** — a "you are here" anchor. In the communities view, **your** communities carry an emerald member ring.
- **Your connections are amber.** Lines touching you stand out from everyone else's.
- **Clusters share a color.** Ties inside a close-knit group are indigo; ties that bridge between groups are slate. A cluster is a tightly-knit pocket of people, detected from the strongest ties.
- **Reputation numbers stay private.** Node detail is **structure-only** — name, degrees away, connection count, and a qualitative relationship state — and shows **no trust score or karma**, not even your own (ADR-082). Your own exact numbers live on your profile and the My Network self-summary, never on the graph.
- **Hover or focus fades the rest.** Pointing at (or keyboard-focusing) a node dims everything not in its neighborhood, so one person's connections are legible inside a dense graph.

## Three scales of one structure (plus fission)

The belonging graph is not several unrelated views — it's **one structure at three zoom levels**. You zoom *out* from yourself, to your community, to the constellation of communities:

- **Scale 1 · My Network** (`ego`) — *you* and your first-degree connections, the network that travels with you across every community. Reached from the top-nav **My Network** link, the profile belonging section, and the explorer (with a depth slider and a "Showing N people within D hops" readout that makes a small, privacy-scoped expansion legible).
- **Scale 2 · This Community** (`community`) — every member of *one* community, grouped into clusters by how closely they connect. The whole-community member topology.
- **Scale 3 · Across Communities** (`communities`) — communities-as-nodes: how your communities connect to others. Drawn as the egocentric hub, with **organic ties** (solid, slate) that accrue as members exchange help across communities and **fission lineage** (dashed, violet) tracing parent→child links left behind when a community splits.

**Fission** is a separate, special-purpose view: a *proposed* community split, colored by the proposed groups.

## Why expansion lives only in the full-page explorer

Most surfaces are a **static, complete** picture: a community view already shows the whole community, so there is nothing to expand. Progressive **click-to-expand** — pulling in a clicked person's neighborhood, up to three at a time — only makes sense for the open-ended **ego** view, where the graph starts small and you choose where to look further. So expansion is offered only at `/network?mode=ego`; everywhere else, activating a node just opens its detail.

## How relationships form and fade

Completing a help exchange strengthens a tie; endorsements, karma, and shared events also contribute. Without continued interaction, a tie's weight **decays** over time — which is why the trust score is the *decayed* current weight. Active trust is what counts.

## Fading bonds

Some lines look softer because Karmyq weights recent, tended relationships more than old ones. A fading
bond is still present — it has just been quieter lately. A nearly forgotten bond is close to leaving
active memory; helping each other again keeps it alive, or you can let it fade. The graph carries a
small **How memory fades** legend so this is readable in words, not only in line opacity.
