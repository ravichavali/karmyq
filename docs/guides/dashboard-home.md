# Your Dashboard Home

Dashboard Home is the first thing you see when you open Karmyq. Sprint 88 gives it a warmer shell, a calmer finite queue, and one feed ordered so the things that need you most are at the top.

## Needs your response

At the very top is the **Needs your response** band — the decisions you owe right now:

- **An offer on your request** — Accept it to match, or Decline it.
- **A reserved request (Dibs)** — Accept or decline a trusted first-ask.
- **A finished exchange** — Mark it done so both sides get credit.

This band only appears when you actually owe a response — when you are all caught up, it disappears.

## Requests you can fill

Below the band is the feed of open requests from your communities and trust network. Each card shows:

- **Your relationship path** — the trust path leads the card, because the important question is "how are we connected?"
- **Who is asking** — the colored circle is the asker's initial; it reads "Asked by {name}" so it is never an unexplained avatar.
- **The ask itself** — a plain title, requester, community, and humanized type label.
- **The details** — type, urgency, community, and any request-specific information (pickup/drop-off for a ride, and so on).
- **Offer to Help** — one tap sends your offer. The card confirms with a link to track it in your Helping tab.
- **A quiet match signal** — backend scores still rank the feed, but the card says things like "good match · 2nd-degree trust" instead of leading with a percentage or a requester Karma badge.

**Tap anywhere on a card to open the full request.** Only the Offer button (and inline links) keep their own action — tapping them does not also open the request. You will not see your own requests here — those appear in your Asks tab and, when someone offers, in the Needs your response band.

## You’ve offered to help

When you have outstanding offers — asks you've offered on that are still waiting to hear back — Dashboard Home shows a calm band near the top: **"You've offered to help on N open asks. Waiting for the requester to respond."** Below it is a short preview of the actual asks, each linking to its own detail page, with a **View all in Helping** link for the full list. The curated feed hides asks you've already offered on (so you don't re-offer), and a pending offer is awaiting the requester rather than a decision you owe — so without this band an active helper's Home would read empty even with many offers in flight. The asks are real and named, not just a count, so you can pick one up where you left off.

## Opening a request

Tapping anywhere on a request card opens its **detail page** — the canonical view of that ask. The detail page always shows the one action available to *you* in the ask's current state: **Offer to Help** (or **Offer service**) when you can act, **"waiting for the requester"** when you've already offered, **"This is your ask"** when it's your own, or a plain finite note (completed, cancelled, matched, or expired) when there's nothing to do. You never see an Offer button that fails when you tap it — eligibility is decided before the page renders.

## Show more open requests

When you *do* have top matches, Dashboard Home starts curated with `minScore=30` so the list stays finite and relevant. If you want the longer tail, **Show more open requests** re-fetches with explicit `minScore=0` and renders lower-scored open asks too — an on-demand expansion, not the default firehose. Once widened, the feed closes with a quiet **"That's everyone for now"** note so it never trails off ambiguously.

## Filtering and Provider Mode

Use the filter chips to narrow by type or urgency. If you run a service as a provider, the on-duty control lets you switch between your community feed, your provider matches, or both.

## You’re caught up

When there are no direct matches for you, Dashboard Home shows **one** honest, calm message — **"You're caught up"** — and points you to your communities, which may still have open asks waiting. It doesn't show a "No top matches" first stage or a "Show more" nudge on an empty Home; an empty *curated* feed only means no direct matches for *you*, not that there's nothing to do. Browse your communities (their weekly pulse links straight to every open ask across the community) to lend a hand.

See [One Feed, Two Views](/docs/concepts/unified-feed) for the thinking behind this.
