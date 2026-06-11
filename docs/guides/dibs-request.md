# Sending a Private Request (Dibs)

Give a trusted provider first right of refusal before your request goes public.

---

## What Is Dibs?

When you create a request on Karmyq, Karmyq can privately notify one trusted person before the request appears in the public feed. That person has a limited window to accept or decline. If they accept, you're matched directly — no public broadcast, no competition. If they decline or the window expires, your request automatically goes public.

This is called giving someone "dibs."

---

## Who Is Eligible?

One condition must be true for the dibs option to appear:

- **There must be a trusted relationship** — Karmyq surfaces a community member you have a prior completed interaction with, or who is a direct trust-graph (exchange) connection in your community even without completed work yet. Strangers with no community trust relationship are never shown as dibs candidates.

For **service requests**, the candidate must also have an active provider profile. For all other request types (mutual aid, rides, borrows, events), any community member with prior interaction history is eligible.

If no eligible candidate is found, the dibs prompt is silently skipped and your request posts publicly as normal.

### Neighbour "first ask" vs provider "dibs"

The same mechanic is framed to fit who you're asking, because community and provider are two facets
of the same person ([Community and Provider: Two Facets](/docs/concepts/community-and-provider-two-facets)):

- On a **service request**, the prompt is a provider **dibs** — a trusted provider gets first right
  of refusal, shown with their provider trust score.
- On a **mutual-aid request** (everyday help, rides, borrows, events), the prompt is a neighbour
  **first ask** — warm, neighbour-framed copy with no "provider" language, offered to a trusted
  community member. If you've completed work together it says so ("You've worked with {name}
  before"); if you're connected only through a shared-community trust edge with no completed work
  yet, it honestly says "You're connected with {name} in your community" instead (the
  `community_connection` framing, Sprint 93).

Either way it's the same private, time-boxed first invitation before your request goes public, and
either way you can accept a neighbour or a provider as your first-ask without being blocked.

---

## How the Window Works

The dibs window depends on whether your request is scheduled or immediate:

- **Scheduled requests**: window is 20% of your lead time (from posting to scheduled date)
- **ASAP / non-scheduled requests**: window is 24 hours

Scheduled example:

| You post | Scheduled for | Lead time | Dibs window |
|---|---|---|---|
| Monday 9am | Tuesday 9am | 24 hours | ~4 hours 48 min |
| Friday 3pm | Saturday 3pm | 24 hours | ~4 hours 48 min |
| Monday 9am | Monday 11am | 2 hours | ~24 minutes |

The person receiving dibs sees the exact expiry time when they receive the notification.

---

## How to Send a Dibs Request

1. **Create any request** — use the + button and fill in your request details. Set a future date/time if scheduled, or leave it blank for ASAP.
2. **Post the request** — after you submit, Karmyq checks for eligible candidates.
3. **Review the suggestion** — if an eligible provider is found, a prompt appears: _"Send [Name] a private heads-up before this goes public?"_ The prompt shows their trust tier and how many times you've worked together.
4. **Confirm or skip** — tap **Send Dibs** to notify them privately, or **Skip** to post publicly right away.

You can only send dibs to one provider per request. There is no retry: once a terminal outcome is reached (accepted, declined, or expired), the decision is final.

---

## What Happens Next

**If the provider accepts:**
- You are matched directly. No one else sees the request.
- The match appears in your Helping tab immediately.
- Karma works the same as any other match.

**If the provider declines:**
- Your request is immediately broadcast to the public feed.
- Any eligible provider in your communities can now respond.

**If the window expires:**
- Same as decline — your request automatically goes public when the dibs window closes.
- You do not need to do anything.

---

## Where to Find Dibs Activity

- **Requesting side**: Check the **Commitments** tab. A request awaiting a dibs response shows a "Waiting for response" badge with the expiry countdown.
- **Provider side**: Dibs notifications arrive as a push notification (if enabled) and appear in the amber provider notification bell. See [Using Provider Mode](provider-mode) for how providers respond.

---

## Tips

- Schedule your request as far in advance as possible to give the provider a meaningful window.
- If you often work with the same provider, dibs is a lightweight way to give them first pick without going outside the platform.
- If the provider you have in mind is not suggested, it usually means you have no prior completed interactions with them yet — complete a request together first.
