# Your Dashboard Home

Dashboard Home is the first thing you see when you open Karmyq. It gives you a warmer shell, a calmer finite queue, and a feed of the open requests you can fill — ranked so the best-fitting asks are at the top.

## Decisions you owe live in the Helping tab

The **Needs your response** band — the decisions you owe right now — lives at the top of the **Helping** tab, not on Home. Those decisions are commitment work (responding to an offer, confirming a reservation, marking an exchange done, rating a finished exchange), so they sit with the rest of your commitments rather than competing with new asks to browse. See [Managing Your Commitments](managing-commitments) for the full band.

## Requests you can fill

Below the band is the feed of open requests from your communities and trust network. Each card shows:

- **Your relationship path** — the trust path leads the card, because the important question is "how are we connected?"
- **Who is asking** — the colored circle is the asker's initial; it reads "Asked by {name}" so it is never an unexplained avatar.
- **The ask itself** — a plain title, requester, community, and humanized type label.
- **The details** — type, urgency, community, and any request-specific information (pickup/drop-off for a ride, and so on).
- **Offer to Help** — one tap sends your offer. The card confirms with a link to track it in your Helping tab.
- **A quiet match signal** — backend scores still rank the feed, but the card says things like "good match · 2nd-degree trust" instead of leading with a percentage or a requester Karma badge.

**Tap anywhere on a card to open the full request.** Only the Offer button (and inline links) keep their own action — tapping them does not also open the request. You will not see your own requests here — those appear in your Asks tab and, when someone offers, in the Needs your response band on the Helping tab.

## You’ve offered to help

When you have outstanding offers — asks you've offered on that are still waiting to hear back — Dashboard Home shows a calm band near the top: **"You've offered to help on N open asks. Waiting for the requester to respond."** Below it is a short preview of the actual asks, each linking to its own detail page, with a **View all in Helping** link for the full list. The curated feed hides asks you've already offered on (so you don't re-offer), and a pending offer is awaiting the requester rather than a decision you owe — so without this band an active helper's Home would read empty even with many offers in flight. The asks are real and named, not just a count, so you can pick one up where you left off.

## Someone suggested you as a helper

Sometimes a community admin or matchmaker suggests *you* as the helper for an open ask. When that
happens, Dashboard Home shows a second calm band: **"N neighbours suggested you as a helper. Accept
or decline in Helping."** Below it is a short preview of those asks, each linking to its detail page,
with a **Respond in Helping →** link. Like the offered-to-help band, this is a calm preview — the
actual **accept/decline** lives in the **Needs your response** band on the Helping tab, so the
decision sits with your other commitment work rather than competing with new asks to browse. This is
different from an offer you made: here the matchmaker proposed you, so the next move is yours.

## Opening a request

Tapping anywhere on a request card opens its **detail page** — the canonical view of that ask. The detail page always shows the one action available to *you* in the ask's current state: **Offer to Help** (or **Offer service**) when you can act, **"waiting for the requester"** when you've already offered, **"This is your ask"** when it's your own, or a plain finite note (completed, cancelled, matched, or expired) when there's nothing to do. You never see an Offer button that fails when you tap it — eligibility is decided before the page renders.

## Show more open requests

When you *do* have top matches, Dashboard Home starts curated with `minScore=30` so the list stays finite and relevant. If you want the longer tail, **Show more open requests** re-fetches with explicit `minScore=0` and renders lower-scored open asks too — an on-demand expansion, not the default firehose. Once widened, the feed closes with a quiet **"That's everyone for now"** note so it never trails off ambiguously.

## Filtering and Provider Mode

Use the filter chips to narrow by type or urgency. If you run a service as a provider, the on-duty control lets you switch between your community feed, your provider matches, or both.

## You’re caught up

When there are no direct matches for you, Dashboard Home shows **one** honest, calm primary message —
**"You're caught up"** — and then a quieter secondary row, **"Still want to lend a hand?"**, that links
to your communities. It doesn't show a "No top matches" first stage or a "Show more" nudge on an empty
Home; an empty *curated* feed only means no direct matches for *you*, not that there's nothing to do.
Browse your communities (their weekly pulse links straight to every open ask across the community) to
lend a hand.

If you have not joined any communities yet, Home uses the shared finite-state treatment and points you
to **Find Communities** before rendering any feed.

See [One Feed, Two Views](/docs/concepts/unified-feed) for the thinking behind this.
