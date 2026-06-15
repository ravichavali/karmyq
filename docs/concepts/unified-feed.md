# One Feed, Two Views

Karmyq used to show the same help request differently depending on where you saw it — the dashboard browse list, a community tab, and an older feed each had their own card, their own wording, and their own idea of what "urgent" or "pending" meant. Worse, the decisions you actually owed people lived in a separate tab from the requests you could help with.

The **unified feed** fixes that. There is now **one feed model, rendered in two views**, and it is ordered by *action altitude*: the decisions a member owes rise to the top, above the requests they can fill.

## What you see on Dashboard Home

1. **Needs your response** — a band at the very top for the decisions you owe right now: an offer to accept or decline, a reserved request to confirm, or a finished exchange to mark done. These always rank above browsing, because someone is waiting on you.
2. **You’ve offered to help** — when you have offers still waiting to hear back, a single band links to your Helping tab. The curated feed hides asks you've already offered on, and a pending offer isn't a decision you owe, so without this band an active helper's Home would read empty even with offers in flight.
3. **Requests you can fill** — the canonical request card, ranked by fit: skills, trust path, urgency, and recency. The card is relationship-led: the trust path is the lead signal, requester Karma is not shown on the card, the asker's avatar reads "Asked by {name}", and the match percentage becomes quiet language such as "good match · 2nd-degree trust". **Tapping anywhere on the card opens the full request**; the Offer button keeps its own action.
4. **Show more open requests** — when you have top matches, the default stays curated at `minScore=30`; a quiet affordance explicitly expands to `minScore=0` for the longer tail, closing with a single "that's everyone for now" note.
5. **You’re caught up** — when there are no direct matches for you, the feed shows one honest, calm message and points you to your communities (which may still have open asks). It does not show a "No top matches" first stage or a "Show more" nudge on an empty Home — an empty curated feed means no matches *for you*, not that there's nothing to do.

## What you see on Community Home

The community tab is the unified feed's **second view** — the *same* canonical card and ordering as
Dashboard Home, scoped to that community. The difference: there is **no "Needs your response" band**
here (decisions are your personal, cross-community queue — a Home concern), and below the requests you
can fill, the feed adds a **texture layer** that gives the community life:

1. **Requests you can fill** — the same relationship-led canonical card as Home, ranked the same way.
2. **Community activity** — a "this week" pulse: exchanges completed, new members, recent top helpers,
   and how many requests still need help. It ranks *below* the requests, never above them.
3. **Stories** — short, warm beats (a neighbour's first exchange, a milestone) ranked at the bottom.

The server owns the ordering — requests, then activity, then stories — and the client renders them in
that order. Community admins also keep a separate stewardship list, because the member feed only surfaces
open, fillable requests.

## One vocabulary, everywhere

- **Urgency** is one scale: urgent, high, medium, low.
- **Match score** remains a backend 0–100 ranking input, but the member card presents it as a qualitative signal with a human-readable reason.
- **Status** uses one member-facing vocabulary; a request whose offer is awaiting your acceptance reads as "Awaiting response".
- **Payload detail** — the card shows the specifics that make a commitment legible (a ride's pickup and dropoff, a move's floors and truck, a tech ask's device), rendered from the request's fine subtype. See [ADR-067](/docs/concepts/adr-067-request-type-payload-vocabulary) for how that subtype is kept distinct from the coarse type filter.

## Designed to forget

The feed is not a permanent ledger of everything you have done. It surfaces *current* requests and decisions, and the relationship signal it uses to rank them is **time-decayed** — a recent exchange counts; a long-dormant one fades toward nothing. The feed reflects the shape of your relationships now, not a scoreboard of your history. It never broadcasts your past acts to others; the only thing it explains is the *connection* between two people.

See [ADR-066: Unified Feed Model](/docs/concepts/adr-066-unified-feed-model) and [ADR-067: request_type vs payload_type](/docs/concepts/adr-067-request-type-payload-vocabulary) for the architecture, and [Your Dashboard Home](/docs/guides/dashboard-home) for the walkthrough.
