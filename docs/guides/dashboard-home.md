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
- **The ask itself** — a plain title, requester, community, and humanized type label.
- **The details** — type, urgency, community, and any request-specific information (pickup/drop-off for a ride, and so on).
- **Offer to Help** — one tap sends your offer. The card confirms with a link to track it in your Helping tab.
- **A quiet match signal** — backend scores still rank the feed, but the card says things like "good match · 2nd-degree trust" instead of leading with a percentage or a requester Karma badge.

You will not see your own requests here — those appear in your Asks tab and, when someone offers, in the Needs your response band.

## Show more open requests

Dashboard Home starts curated with `minScore=30`, so the default list stays finite and relevant. If you want the longer tail, **Show more open requests** re-fetches with explicit `minScore=0` and renders lower-scored open asks too. This is an on-demand expansion, not the default firehose.

Once you've widened the feed, it has a clear bottom: a quiet **"That's everyone for now"** note tells you you're seeing every open ask you can fill, so the list never just trails off ambiguously. The note only appears after you choose to show more — the curated default ends with the **Show more** button instead.

## Filtering and Provider Mode

Use the filter chips to narrow by type or urgency. If you run a service as a provider, the on-duty control lets you switch between your community feed, your provider matches, or both.

## You’re caught up

"You're caught up" and "Show more open requests" never appear at the same time — that would be a contradiction. Before you've widened the feed, Dashboard Home doesn't know whether lower-ranked asks exist, so it offers **Show more open requests** under honest copy ("No top matches right now") instead of claiming you're done. Only after you widen the feed (and there's genuinely nothing left) does it say **You're caught up** and drop the Show-more button. When there *are* lower-ranked asks, widening reveals them and closes with a single "That's everyone for now" note.

See [One Feed, Two Views](/docs/concepts/unified-feed) for the thinking behind this.
