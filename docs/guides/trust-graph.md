# Understanding Your Community's Trust Graph

Every community on karmyq builds a trust graph over time. Each completed help exchange, endorsement, and karma interaction adds to the bond between two members. The Trust Graph tab makes those bonds visible.

## How to Access It

You'll meet the trust graph in several places, all drawn in the same visual language:

- **Primary navigation → My Network** (Sprint 113) — the graph is now a top-level destination: a **My Network** link in the main nav, and a prominent **My Network** preview card on your Home feed, both opening the full-page explorer at `/network`.
- **Community → Trust Graph tab** — two sub-tabs, **This Community** and **My Network**, plus a **See how communities connect →** link up to the across-communities view.
- **Dashboard → Your Trust Network** panel — a **People / Communities** toggle, with a **View full →** link.
- **Profile → How you're woven into Karmyq** — your belonging section, with a connection/community pulse and an **Explore your full network →** link.
- **The full-page explorer at `/network`** — the roomy, interactive version (see below).

## One visual language (Sprint 79, unified in Sprint 111)

Every belonging-graph surface now renders through a single engine, so an intuition learned in one carries to the next:

- **Every *person* node is the same size.** Node size no longer encodes trust, so it can't mislead — you read *structure* (who clusters together, who bridges groups), not dot size. (The one exception is the across-communities scale, where a node is a whole *community* and its size honestly encodes membership — see Scale 3 below.)
- **You are enlarged and white-ringed** as a "you are here" anchor.
- **Your connections are amber.** Every line touching your node is highlighted so you can find yourself in the wider network.
- **Structure, not scores.** Nodes show *who connects to whom*; a node's detail panel gives degrees away and connection count, never a trust score or karma (those are private to you — see below). Edge thickness/fade reflects the *decayed* current strength of each bond, the same in every view.
- **Hover or focus a node** (mouse or keyboard) and unrelated people and lines fade back, so the node's own neighborhood stands out. Every node is keyboard-reachable, carries its full name as a tooltip, and activates with Enter or Space.
- **Zoom controls** (＋ / − / reset) sit in the top-right of every graph (Sprint 113) — click to zoom in, out, or recenter. Drag the background to pan, and pinch to zoom on touch. (The mouse wheel scrolls the page as usual — it no longer hijacks into zoom.)

## The full-page explorer (`/network`)

`/network` is the roomy, interactive home of the graph. A mode switch at the top moves between **three explicit zoom levels of one belonging structure** (Sprint 113), and a search box focuses any **already-loaded** node (it doesn't search the whole platform — it spotlights someone already on screen). The graph pans and zooms.

The three are adjacent scales, not redundant views — you zoom *out* from yourself, to your community, to the constellation of communities:

- **Scale 1 · My Network (`?mode=ego`)** — *you* at the centre with your first-degree connections. This is the view that travels with you across every community. A **depth** slider (1–3) controls how many hops out the starting picture reaches, and a **"Showing N people within D hops"** readout names exactly how many people each depth surfaces — so even a small expansion is legible (under the privacy scope the seed graph is often sparse, so a jump from a handful of people to a few more can be easy to miss on a big canvas). If no one is in view yet, an honest sparse state explains that connections grow from the help you give and receive. Activate any node to **expand** its neighborhood inline; up to three expansions stay open at once, and a fourth quietly retires the oldest. Each open expansion gets a **Collapse {name}** chip; collapsing recomputes cleanly from your baseline plus whatever's still open.
- **Scale 2 · This Community (`?mode=community&id=…`)** — the **whole** selected community's member topology, exactly like the This Community sub-tab. It's searchable and zoomable but has no depth slider and no inline expansion — the picture is already the full community.
- **Scale 3 · Across Communities (`?mode=communities`)** — communities-as-nodes: how your communities connect to others (the level-up). Rendered as an **egocentric hub** (see below).

Progressive expansion lives **only** in the My Network scale; every other surface is a static, complete picture.

## Community View

The Community tab shows **every member** of your community arranged on a circle, grouped by how closely they're connected. Edges bundle together when they follow similar paths through the network — a technique called *hierarchical edge bundling*. The result reveals the community's structure at a glance.

**What you see:**

- **Nodes on the circle** are community members, grouped into clusters by their strongest connections.
- **Bright, bundled edges within a group** are strong, active relationships — the dense core of a sub-community.
- **Thin, muted threads crossing between groups** are weak connections — the ties that would break first in a split.
- **Amber edges** are *your* connections.

Groups are detected automatically from the strongest connections, so the layout reflects how the community actually clusters rather than any imposed structure.

**A note on crossing lines.** Hierarchical edge bundling reduces visual clutter by routing similar paths together, but some crossings remain — they're inherent to a dense, real network drawn on a circle, not a bug. (The across-communities scale no longer uses this radial bundle at all — it's the egocentric hub described below, which trades the bundle's prettiness for plain legibility.) The member-level trust graph keeps its cluster-based bundling: crossings there can't be removed by a simple reordering without either changing the underlying relationships or hand-placing nodes, neither of which we do.

## My Network View

The My Network tab shows **your first-degree network within this community** — the people you've built trust with here — clustered by how closely they connect to each other. It's a static, structure-revealing view; click any node to open its detail panel. For privacy, every panel shows only structure — name, degrees away, and connection count — and **no node shows a trust score or karma**, not even your own (see [Whose numbers you can see](#whose-numbers-you-can-see-reputation-disclosure-boundary) below). Your own exact numbers live on your profile and the My Network self-summary instead.

## Your Trust Network (dashboard)

The dashboard panel toggles between two views of your trust:

- **People** — your trust network aggregated across **all** your communities, in the same clustered ego style as My Network.
- **Communities** — the inter-community **depth view** (below).

## Across Communities — the egocentric hub (Scale 3)

The across-communities view (`?mode=communities`) draws **communities as nodes** so you can see how your communities connect to others. As of Sprint 113 it's an **egocentric hub** (replacing the earlier radial edge-bundle, which was pretty but busy): **your** communities are anchored together in the **centre**, and the communities they connect to **radiate outward on a ring** — every node **always labelled**, so it stays legible even when crowded.

- **Node size = membership.** A bigger community is a bigger dot — the one place a node's size is meaningful (because here a node is a whole community, not a person).
- **Colour.** Your own communities are emerald and white-ringed; communities you can see but aren't a member of are indigo.
- **Organic ties (solid, slate).** Accrued automatically as members exchange help *across* community lines — a sign two communities are genuinely intertwined. Thicker = stronger.
- **Fission lineage (dashed, violet).** Parent → child links left behind when a community splits. This is how you trace a community's family tree after a [fission](/docs/guides/community-fission).

Click any community for its member count and status. You can reach this scale from the **See how communities connect →** link on any community's Trust Graph tab.

## Reading Edge Strength

Edge thickness and opacity tell you how *alive* a relationship currently is:

- **Thick, bright edge** — active recently. The trust bond is strong.
- **Thin, faded edge** — exists but hasn't been reinforced in a while. The bond is weakening.
- **Very faint thread** — near the disappearance threshold. Without a new interaction it will eventually be removed by the nightly cleanup.

Strength is computed from the **interaction half-life**. A single exchange fades to half-strength after about 30 days. Repeated interactions build **stability**, extending the relationship's half-life significantly — a relationship built on 10+ exchanges has a half-life measured in months to years.

See [Interaction Half-Life](/docs/guides/interaction-half-life) for a full explanation of how trust decays and stabilizes.

## What Drives Trust?

Four interaction types contribute to trust bonds:

| Interaction | Weight |
|-------------|--------|
| Completed help exchange | 10 |
| Endorsement | 5 |
| Karma given | 3 |
| Shared event | 2 |

Older interactions contribute less than recent ones — trust bonds reflect current relationships, not just historical ones. The trust score you see is the *decayed* total, so active trust is what counts.

## Fission Split View

When your community has an active fission proposal, the trust graph shows the same circular, bundled layout — but cluster assignment comes from the proposed split groups rather than automatic detection. Members are color-coded by their proposed group (blue = Group A, orange = Group B, gray = unassigned).

- **Green edges** are strong within-group connections — relationships that stay intact after the split.
- **Red threads** are cross-group connections — the contested relationships that span the proposed boundary and make a split costly.
- A **dashed ring** marks members with no trust connections yet.

Click any member to see their proposed group and connection count. If you're an admin, you can move them between the proposed groups from the panel below the graph.

## Who Appears in the Graph

The graph only shows people who are **currently active members** of the community context you're viewing. A trust edge can outlive membership — you might have completed an exchange with someone who later left — but a departed member is no longer shown under "your network in this community," because the graph is a picture of *who's here now*, not a historical archive. The aggregate "across your communities" view follows the same rule: it shows people you've built trust with who are still active in a community you share. Node trust scores and edge thickness use the decayed, recency-weighted trust metric ("designed to forget"), not raw lifetime counts.

## Trust-Gated Governance

The trust graph powers community governance. Members with high enough trust scores become eligible for governance roles (Admin, Moderator). Eligible members can be nominated and ratified through the **Governance** tab on any community page. As of Sprint 112, governance shows eligible members and role holders by name with a coarse explanation — "Eligible for stewardship — eligibility threshold met through established community relationships" — and never another member's trust or karma numbers.

See [Trust-Gated Governance](/docs/concepts/governance) for the full governance model.

## Whose numbers you can see (Reputation Disclosure Boundary)

The belonging graph shows **relationship structure**, not reputation scores. As of Sprint 112
(ADR-082), node detail shows who you're connected to and how (degrees away, connection count, and a
qualitative relationship state — strong, warm, fading, nearly forgotten) — but **no node shows a trust
score or karma**, not even your own. Your own exact Reputation score and Current karma live in your
profile and **My Network** self-summary (one canonical, community-scoped source), never on the graph
and never on another member's card. This is enforced at the API, not just hidden in the interface.
