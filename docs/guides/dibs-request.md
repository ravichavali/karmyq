# Sending a Private Request (Dibs)

Give a trusted provider first right of refusal before your request goes public.

---

## What Is Dibs?

When you create a *scheduled* request, Karmyq can privately notify one trusted provider before the request appears in the public feed. That provider has a limited window to accept or decline. If they accept, you're matched directly — no public broadcast, no competition. If they decline or the window expires, your request automatically goes public.

This is called giving someone "dibs."

---

## Who Is Eligible?

Two conditions must both be true for the dibs option to appear:

1. **Your request must be scheduled** — you set a future date and time for when you need help. ASAP requests always broadcast immediately; there is no dibs option for them.
2. **There must be a trusted provider with prior history** — Karmyq only surfaces providers you have at least one prior completed interaction with. New providers you have never worked with are never shown as dibs candidates.

If no eligible provider is found, the dibs prompt is silently skipped and your request posts publicly as normal.

---

## How the Window Works

The dibs window is 20% of your lead time — calculated from when you post to when you need the help.

For example:

| You post | Scheduled for | Lead time | Dibs window |
|---|---|---|---|
| Monday 9am | Tuesday 9am | 24 hours | ~4 hours 48 min |
| Friday 3pm | Saturday 3pm | 24 hours | ~4 hours 48 min |
| Monday 9am | Monday 11am | 2 hours | ~24 minutes |

There is no minimum window. If you post close to the scheduled time, the window will be short — that is the cost of scheduling late. The provider sees the exact expiry time when they receive the notification.

---

## How to Send a Dibs Request

1. **Create a scheduled request** — use the + button, fill in your request details, and set a future date and time in the "Scheduled for" field.
2. **Post the request** — after you submit, Karmyq checks for eligible providers.
3. **Review the suggestion** — if an eligible provider is found, a prompt appears: _"Send [Name] a private heads-up before this goes public?"_ The prompt shows their trust tier and how many times you've worked together.
4. **Confirm or skip** — tap **Send Dibs** to notify them privately, or **Skip** to post publicly right away.

You can only send dibs to one provider per request. There is no retry: once a terminal outcome is reached (accepted, declined, or expired), the decision is final.

---

## What Happens Next

**If the provider accepts:**
- You are matched directly. No one else sees the request.
- The match appears in your Commitments tab immediately.
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
