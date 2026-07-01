# Community and Provider: Two Facets of the Same Person

On Karmyq, "neighbour" and "service provider" are not two different kinds of account. They are two
**facets** of the same person — two ways the same member shows up depending on what's being asked.

---

## The same person, two facets

- As a **neighbour**, you take part in mutual aid: you offer a hand with a move, a ride, a borrowed
  ladder, an hour of company. No money changes hands. Trust grows from showing up.
- As a **provider**, you offer a **service** through a provider profile — something more defined,
  sometimes scheduled, sometimes with a price. Providers carry a provider trust score built from
  reviews of that service.

You can be both. The neighbour who helped you move boxes last month might also run a service you
book next month. Karmyq keeps these connected on purpose: the trust you build in one facet informs
how the platform treats you in the other.

---

## Why you sometimes see "provider" language and sometimes "neighbour"

Because the two facets are real, the platform frames the **same mechanic** differently depending on
which facet a request touches:

| | Neighbour facet (mutual aid) | Provider facet (services) |
|---|---|---|
| Request type | everyday help, rides, borrows, events | **service** requests |
| First-ask | a private **first ask** to a trusted neighbour | **dibs** — first right of refusal to a trusted provider |
| Who's eligible | a community member you've worked with before | a provider with an active profile you've worked with before |
| Trust shown | your prior exchanges + connection | provider trust score + prior exchanges |
| Offer action | **Offer to Help** | **Offer service** |

This is why a mutual-aid request offers a warm, neighbour-framed "first ask" rather than a
"provider" prompt — surfacing a neighbour as a "provider" was simply the wrong framing
([ADR-072](/docs/concepts/adr-072-dibs-scope)).

The same boundary applies after a request is public. Mutual-aid asks keep the neighbour action
language, **Offer to Help**. Service asks use service-specific language, **Offer service**, on both
request cards and request detail pages.

---

## The first-ask, in both facets

Whether neighbour or provider, the idea is the same: before a request goes public, you can give one
trusted person a private, time-boxed window to say yes first. If they accept, you're matched
directly. If they decline or the window closes, the request posts publicly. Only the **framing**
differs — the trust gesture is identical.

---

## Closing the loop is the same everywhere

However a request was made and whoever fills it, closing it works the same way: both people mark the
exchange done, and once **both** have confirmed, the exchange is fully complete and you can rate it.
Marking done from your Dashboard or from your Commitments tab does exactly the same thing — one
help-loop, one source of truth.

---

## Why this matters

Treating community and provider as two facets of one person — rather than two separate systems —
keeps trust portable and keeps the platform legible. You don't manage two identities; you show up as
yourself, and Karmyq adjusts the framing to fit what's being asked.

## Provider identity in the relationship lens (Sprint 116)

In the reciprocal relationship lens a provider is the same person node as anyone else. Their service
type and collective appear as a decoration/badge on that equal node — a facet of one identity, never a
size or rank. The requester sees this provider role while reviewing the offer; the provider never sees
their own collective label reflected back.
