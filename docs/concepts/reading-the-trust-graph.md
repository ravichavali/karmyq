# Reading the Trust Graph

The trust graph turns your completed help exchanges into a picture. Each person you've built trust with is a **node**; each relationship is a **link**. Quieter relationships draw fainter lines. It's the platform's memory of who has actually shown up for whom.

## Earned structure, not invented shape

As of Sprint 115 (ADR-083), the graph draws **only what the data says**. Where a node sits and whether a line exists come from disclosed relationships — never from a layout algorithm guessing at "groups." Earlier versions used a force/bundle layout that detected clusters and routed edges through them; that produced a confident-looking picture of cores and groups that was an artifact of the algorithm, not a fact about the community. We removed it. There are no inferred clusters, no bundles, and no node "health" or centrality score.

## One model, contextual renderers, one visual language

Every belonging-graph surface shares **one data model** and **one visual language**, but each context draws it with a purpose-built, deterministic renderer:

- **Every person node is the same size.** A person's dot doesn't encode a variable, so it can't mislead. (The exception is a *community* node on the across-communities scale, whose size honestly encodes membership.)
- **You are emerald and white-ringed** — a "you are here" anchor. In the communities view, **your** communities carry the ring.
- **Your connections are amber.** Lines touching you stand out from everyone else's; a focused line turns teal, and a line that is both yours and focused stays amber.
- **Direct lines, intensity not thickness.** A line exists only between two people with a disclosed relationship. At-rest width is constant; opacity carries the qualitative state — strong (brightest), warm, fading, nearly forgotten, swept (barely visible).
- **Reputation numbers stay private.** Clicking a person shows only their name, connection count, degrees away, and relationship states — never a trust score or karma, not even your own.
- **Hover or focus fades the rest.** Pointing at (or keyboard-focusing) a node dims everything not in its neighborhood, so one person's connections are legible inside a dense graph. Focus never moves anything — the layout is stable.

## Three scales of one structure (plus fission)

The belonging graph is not several unrelated views — it's **one structure at three zoom levels**. You zoom *out* from yourself, to your community, to the constellation of communities:

- **Scale 1 · My Network** (`ego`) — *you* at the centre with everyone placed on **concentric orbits by how many hops away they are from you**. The network that travels with you across every community. Reached from the **My Network** nav link and a Home preview card, the profile belonging section, the dashboard People toggle, and the explorer (with a depth slider and a "Showing N people within D hops" readout). Expanding a person never moves the people already on screen.
- **Scale 2 · This Community** (`community`) — **every returned member on one ring**, with one direct chord per disclosed relationship. No clusters, no bundles. You read redundancy, bridges, isolates, and indispensable people from the topology itself. If the view is partial it says "Showing N of M active members" and scopes bond counts to the members shown.
- **Scale 3 · Across Communities** (`communities`) — communities-as-nodes: how your communities connect to others. Drawn as the egocentric hub, with **organic ties** (solid, slate) that accrue as members exchange help across communities and **fission lineage** (dashed, violet) tracing parent→child links left behind when a community splits.

**Fission** is a separate, special-purpose view: a *proposed* community split, colored by the proposed groups (green within-group ties, red cross-group ties, a dashed ring for isolated members).

## Why expansion lives only in the ego view

Most surfaces are a **static, complete** picture: a community view already shows the whole community, so there is nothing to expand. Progressive **click-to-expand** — pulling in a clicked person's neighborhood — only makes sense for the open-ended **ego** view, where the graph starts small and you choose where to look further. So expansion is offered in My Network (up to three at a time on the explorer, one replaceable branch on your profile); everywhere else, activating a node just opens its detail.

## A connection is context, not a score

A line means two people have helped each other. It is **context**, not an endorsement and not transferable trust you can spend elsewhere. The graph shows how a community is woven together; it does not rank or vouch for anyone.

## How relationships form and fade

Completing a help exchange strengthens a tie; without continued interaction it **decays** over time — which is why a quiet relationship draws a fainter line. A fading bond is still present, just quieter lately; a nearly forgotten bond is close to leaving active memory, and helping each other again keeps it alive. The graph carries a small **How memory fades** legend so this is readable in words, not only in line opacity.
