# Understanding Your Community's Trust Graph

Every community on karmyq builds a trust graph over time. Each completed help exchange adds to the bond between two members. The trust graph makes those bonds visible — and, as of Sprint 115, it draws **only what the data actually says**: where a node sits and whether a line exists are facts about disclosed relationships, never a layout's guess about "groups."

## How to Access It

You'll meet the trust graph in several places, all drawn in the same visual language:

- **Primary navigation → My Network** — the graph is a top-level destination: a **My Network** link in the main nav and a prominent preview card on your Home feed, both opening the full-page explorer at `/network`.
- **Community → Trust Graph tab** — two sub-tabs, **This Community** and **My Network**, plus a **See how communities connect →** link up to the across-communities view.
- **Dashboard → Your Trust Network** panel — a **People / Communities** toggle, with a **View full →** link.
- **Profile → How you're woven into Karmyq** — your belonging section, with a connection/community pulse and an **Explore your full network →** link.
- **The full-page explorer at `/network`** — the roomy, interactive version.

## One visual language

Every belonging-graph surface shares the same encoding, so an intuition learned in one carries to the next:

- **Every person node is the same size.** Node size never encodes a person's importance, so it can't mislead — you read *structure*, not dot size. (The one exception is the across-communities scale, where a node is a whole *community* and its size honestly encodes membership — see below.)
- **You are emerald and white-ringed** as a "you are here" anchor.
- **Your connections are amber.** Every line touching your node is highlighted so you can find yourself in the wider network.
- **Lines are direct.** A line exists between two people if — and only if — they have a disclosed relationship. Nothing is bundled, routed, or inferred.
- **Intensity, not thickness, shows how alive a bond is.** At-rest line width is constant; what varies is opacity, in five qualitative bands:

  | Relationship state | Appearance |
  |---|---|
  | Strong | brightest |
  | Warm | bright |
  | Fading | soft |
  | Nearly forgotten | faint |
  | Swept | barely visible (about to leave active memory) |

- **Newly formed bonds read as new — on the My Network view.** In the ego (My Network) view, a
  bond whose relationship first formed within the last month carries a bright green **New bond**
  emphasis (a distinct hue and a slightly stronger line), layered on top of its intensity band,
  and the legend names it. It's qualitative on purpose — Karmyq never shows dates or counts on
  the graph — and it applies to the *relationship*, not to each community copy of it: a
  long-standing pair connecting in a second community is not "new". Together with the fading
  bands, this completes the graph's living story — bonds are visibly born, strengthen, and fade.

- **An invitation is not a bond.** When you join through an invitation, the arrival screen draws
  a dashed **invitation bond** to your inviter — that's provenance, shown once at arrival. It
  never appears in these graphs as a trust line; it becomes one only through real exchanges.

- **Hover or focus a node** (mouse or keyboard) and its incident lines brighten while everything unrelated recedes. A focused line thickens slightly as an *interaction cue only* — it never means more data. Every node is keyboard-reachable, carries its full name as a tooltip, and activates with Enter or Space.
- **Above ~40 people, only key names stay printed** (you, the focused node, and anything you've searched) so the canvas stays legible; every other person keeps a tooltip and is still focusable — focus or search to reveal a name.
- **Zoom controls** (＋ / − / reset) sit in the top-right of every graph — click to zoom, drag the background to pan, pinch to zoom on touch. (The mouse wheel scrolls the page as usual.)

## Scale 1 · My Network (ego orbits)

The My Network view puts **you at the centre**, with everyone else placed on **concentric orbits by how many hops away they are from you** — first-degree connections on the inner orbit, friends-of-friends further out. Distance is computed locally from *your* node, so the picture is honest about reach.

- A **depth** slider (1–3) controls how many hops the starting picture reaches, and a **"Showing N people within D hops"** readout names exactly how many people each depth surfaces.
- Activate any node to **expand** its neighborhood inline. On the explorer up to three expansions stay open at once (a fourth quietly retires the oldest); on your profile a single expansion replaces the previous one. **Expanding never moves the people already on screen** — your baseline orbits stay put, so the map you've built up in your head survives every expand and collapse.
- If no one is in view yet, an honest sparse state explains that connections grow from the help you give and receive.

This is the view that travels with you across every community.

## Scale 2 · This Community (the member ring)

The This Community view arranges **every returned member on a single ring**, in a stable order, with **one gently curved chord per disclosed relationship**. There are no clusters, no bundles, and no automatic grouping — the shape you see is just who is connected to whom.

Its at-a-glance question is **“Where do you fit?”** When you belong to the community, your node is
anchored at 12 o'clock, your chords keep their full relationship intensity, and the other chords
quiet slightly until you focus them, with even the faintest related chord kept visibly distinct
from unrelated content. A plain-language line below the ring says how many of the other members
you're bonded with. If you have no bonds there yet, it says so honestly and points to the
first real way to become woven in: helping someone. This emphasis rotates and quiets the existing
picture; it never changes who is present or invents a relationship.

Reading it is structural, by eye:

- **Multiple routes between two people** mean redundant belonging — the community doesn't depend on any single link.
- **Several bridges** between parts of the ring mean it's well knit together.
- **Few isolates** mean most members are woven in.
- **One person every chord runs through** means the community leans on an indispensable member.

If the community is larger than the view can show, it says **"Showing N of M active members"** and
scopes the bond summary to **"the N members shown"** — never to the whole community. You can't judge
redundancy from a partial picture. The members shown are selected **neutrally** (by name), never by
any score.

Click any member for a structural detail panel — their connection count and the qualitative states of their relationships. No member's trust score or karma appears here (see [Whose numbers you can see](#whose-numbers-you-can-see-reputation-disclosure-boundary)).

## Scale 3 · Across Communities — the egocentric hub

The across-communities view (`?mode=communities`) draws **communities as nodes** so you can see how your communities connect to others. It is an **egocentric hub**: your communities are anchored together in the centre, and the communities they connect to radiate outward on a labelled ring.

Its at-a-glance question is **“Which of your communities are woven together?”** Solid bridges
between two communities you belong to come forward. A recently active bridge uses the same living
green family as a new personal bond; a dormant bridge remains visible but quiet. Bridges from your
communities to the surrounding periphery stay in the picture with less emphasis. “Recent” is a
server-derived, fail-closed qualitative state from the last month of exchange activity — no date,
count, or raw weight is exposed.

- **Node size = membership.** A bigger community is a bigger dot — the one place a node's size is meaningful, because here a node is a whole community, not a person.
- **Colour.** Your own communities are emerald and white-ringed; communities you can see but aren't a member of are indigo.
- **Organic ties (solid)** accrue as members exchange help *across* community lines. The concise
  legend names the useful distinction directly: **Woven bridge — recent exchange** or
  **Dormant bridge**.
- **Fission lineage (dashed, violet)** are parent → child links left behind when a community splits.

Click any community for its member count and status. Reach this scale from the **See how communities connect →** link on any community's Trust Graph tab.

## Fission Split View

When your community has an active fission proposal, the graph shows the proposed split. Members are colour-coded by their proposed group (blue = Group A, orange = Group B, gray = unassigned).

- **Green edges** are strong within-group connections — relationships that stay intact after the split.
- **Red threads** are cross-group connections — the contested relationships that span the proposed boundary and make a split costly.
- A **dashed ring** marks members with no trust connections yet.

Click any member to see their proposed group and connection count. If you're an admin, you can move them between the proposed groups from the panel below the graph.

## Who Appears in the Graph

The graph only shows people who are **currently active members** of the community context you're viewing. A trust edge can outlive membership — you might have completed an exchange with someone who later left — but a departed member is no longer shown, because the graph is a picture of *who's here now*, not a historical archive. The aggregate "across your communities" view follows the same rule. Relationship intensity uses the decayed, recency-weighted trust signal ("designed to forget"), not raw lifetime counts.

## A connection is context, not a score

A line on the graph means two people have helped each other — it is **context**, not an endorsement, and not transferable trust you can spend elsewhere. The graph shows how the community is woven together; it does not rank people, score them, or vouch for them. Reputation numbers stay private (below).

## Whose numbers you can see (Reputation Disclosure Boundary)

The belonging graph shows **relationship structure**, not reputation scores. As of Sprint 112
(ADR-082), node detail shows who you're connected to and how (degrees away, connection count, and a
qualitative relationship state — strong, warm, fading, nearly forgotten) — but **no node shows a trust
score or karma**, not even your own. Your own exact Reputation score and Current karma live in your
profile and **My Network** self-summary (one canonical, community-scoped source), never on the graph
and never on another member's card. This is enforced at the API, not just hidden in the interface.
