# Match Lifecycle

Understanding how a match moves from proposal to completion helps you know what to expect at every stage.

---

## The Four Stages

```
Proposed → Accepted (Matched) → Both Mark Done → Completed
```

### 1. Proposed

A helper offers to respond to your request, or your community admin suggests a match. The match card appears in:

- **Helper's tab:** "Awaiting Acceptance" — they wait for you to accept
- **Requester's tab:** "Needs Your Response" — you decide whether to accept or decline

At this stage, no karma has moved and neither party is committed. Because a proposed offer is awaiting the *requester*, it is **not** a decision the helper owes — so the helper sees it in their Dashboard Home **"You've offered to help"** preview (a calm list waiting on the requester), and on the request's own detail page as **"waiting for the requester to respond"**, never as an action they need to take.

### 2. Accepted (Matched / In Progress)

The requester clicks **Accept**. Both sides now have a commitment:

- The card moves to **"In Progress"** for both parties
- The request is marked as matched (other offers stop being shown)
- The inline conversation is available for coordination
- Karma has not transferred yet

### 3. Both Mark Done

After the help happens, **both parties** independently confirm completion:

1. Helper clicks **Mark Done** → sees "Waiting for requester to confirm"
2. Requester clicks **Confirm Done** → exchange is finalized

If only one party marks done, the exchange stays In Progress. The other party hasn't confirmed yet. Use the inline conversation to follow up.

### 4. Completed

Once both parties confirm:

- The card moves to **Completed** and fades gradually over 30 days
- Karma transfers from the requester's balance to the helper
- Trust scores update for both parties

---

## Withdrawing Before Acceptance

If you've offered to help (the match is still "Proposed") and circumstances change:

**As the helper:** Click **Withdraw Offer** on the card. Your offer is removed and the request goes back to open status.

**As the requester:** Click **Decline** on the proposed match. The card is removed and the request reopens for other helpers.

Withdrawal is only possible before acceptance. Once a match is In Progress, reach out via the inline conversation.

---

## What Karma Transfers

Karma transfers only when **both parties confirm done**. This prevents either party from claiming completion unilaterally. The amount transferred is set by the request's karma value, which the requester specified when posting.

---

## Waiting States

| Who acted | What the other side sees |
|-----------|--------------------------|
| Helper marked done | "Waiting for requester to confirm" |
| Requester confirmed done | "Waiting for helper to confirm" |
| Both confirmed | Exchange moves to Completed |

---

## Your Actions Are Tied to Your Identity

Accepting, declining, withdrawing, and marking a match done are always tied to the
account you're signed in as. Only the two people in a match — the requester and the
helper — can act on it, and the platform decides who you are from your secure login
session, not from anything your browser sends. There's nothing to configure; it's
just how these actions are protected. (Behind the scenes this is enforced by
ADR-064 — authorize from the authenticated identity, never a client-supplied id.)
