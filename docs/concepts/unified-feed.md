# One Feed, Two Views

Karmyq used to show the same help request differently depending on where you saw it — the dashboard browse list, a community tab, and an older feed each had their own card, their own wording, and their own idea of what "urgent" or "pending" meant. Worse, the decisions you actually owed people (an offer to accept, an exchange to mark done) lived in a separate tab from the requests you could help with.

The **unified feed** fixes that. There is now **one feed model, rendered in two views**, and it is ordered by *action altitude*: the decisions a member owes rise to the top, above the requests they can fill.

## What you see on Dashboard Home

1. **Needs your response** — a band at the very top for the decisions you owe right now: an offer to accept or decline, your own offer you can withdraw, a reserved request to confirm, or a finished exchange to mark done. These always rank above browsing, because someone is waiting on you.
2. **Requests you can fill** — the one canonical request card, ranked by how well it fits you: your skills, your trust path to the requester, urgency, and recency. Each card explains *why* it is here ("42% · 2nd-degree trust"), shows the requester’s Karma and your trust path, and offers a single **Offer to Help** action.
3. **You’re caught up** — when there is nothing left to fill, the feed says so and points you to your communities, instead of padding the list.

## What you see on a community's Requests tab

The community tab is the unified feed's **second view** — the *same* canonical card and ordering as
Dashboard Home, scoped to that community. The difference: there is **no "Needs your response" band**
here (decisions are your personal, cross-community queue — a Home concern), and below the requests you
can fill, the feed adds a **texture layer** that gives the community life:

1. **Requests you can fill** — the same canonical card as Home, ranked the same way.
2. **Community activity** — a "this week" pulse: exchanges completed, new members, recent top helpers,
   and how many requests still need help. It ranks *below* the requests, never above them.
3. **Stories** — short, warm beats (a neighbour's first exchange, a milestone) ranked at the bottom.

The server owns the ordering — requests, then activity, then stories — and the client renders them in
that order. Community admins also keep a separate management list (filter by open / pending / matched /
completed, with triage and boost controls), because the feed itself only surfaces *open, fillable*
requests.

## One vocabulary, everywhere

- **Urgency** is one scale: urgent, high, medium, low.
- **Match score** is always a 0–100 percentage with a human-readable reason — never a bare opaque number.
- **Status** uses one member-facing vocabulary; a request whose offer is awaiting your acceptance reads as "Awaiting response".
- **Payload detail** — the card shows the specifics that make a commitment legible (a ride's pickup and dropoff, a move's floors and truck, a tech ask's device), rendered from the request's fine subtype. See [ADR-067](/docs/concepts/adr-067-request-type-payload-vocabulary) for how that subtype is kept distinct from the coarse type filter.

## Designed to forget

The feed is not a permanent ledger of everything you have done. It surfaces *current* requests and decisions, and the relationship signal it uses to rank them is **time-decayed** — a recent exchange counts; a long-dormant one fades toward nothing. The feed reflects the shape of your relationships now, not a scoreboard of your history. It never broadcasts your past acts to others; the only thing it explains is the *connection* between two people.

See [ADR-066: Unified Feed Model](/docs/concepts/adr-066-unified-feed-model) and [ADR-067: request_type vs payload_type](/docs/concepts/adr-067-request-type-payload-vocabulary) for the architecture, and [Your Dashboard Home](/docs/guides/dashboard-home) for the walkthrough.
