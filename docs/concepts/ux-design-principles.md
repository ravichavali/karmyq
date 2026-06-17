# UX Design Principles

Karmyq is built around one idea: the platform should get out of the way and let people help each other. Every design decision flows from that.

---

## The Five Core Flows

Every thing a user does in Karmyq falls into one of five flows:

1. **Browse** — Find requests from community members and offer to help
2. **Commit** — Follow through on promises made and track active help
3. **Request** — Ask your community for what you need
4. **Receive** — Accept help and acknowledge when it's done
5. **Profile** — Build and maintain your reputation and trust network

These flows are surfaced directly in the navigation — not buried in menus, not hidden in sidebar widgets. They are the product.

---

## One Screen, One Job

Each tab has a single job:

- **Browse** shows you who needs help. Nothing else.
- **Commitments** shows you what you've promised and what you're waiting on. Nothing else.
- **My Requests** shows you what you've asked for. Nothing else.
- **Profile** shows you your reputation and settings. Nothing else.

When a screen tries to do multiple jobs, users don't know what to do. A dashboard that shows your karma, the community feed, a create form, upcoming events, and recent matches is technically complete — but it's exhausting to use.

---

## Commitments as a First-Class Concept

Most mutual aid apps treat a "match" as a backend record. Karmyq surfaces it as something with a name — a **commitment**.

When you offer to help someone and they accept, that's a commitment. It lives in its own tab. It has a status. It has a clear action to take next. It isn't buried in a feed item or in your notification history.

This matters because commitments are the heart of what Karmyq does. If someone agrees to give you a lift, that agreement deserves its own place in your attention — not a line in a list.

---

## Reducing Cognitive Load

Cognitive load is the mental effort required to use something. The three-column dashboard design that many platforms use (sidebar + feed + right rail) asks users to make many small decisions: where do I look? what's important? what can I ignore?

The tab-based layout reduces this by:

1. **Hiding irrelevant information** — if you're on Browse, you're not seeing your karma or your past requests
2. **Progressive disclosure** — filter chips only appear when you've started filtering; urgency chips only appear when a type filter is active
3. **Clear primary actions** — the FAB ("Get Help") is always visible on the two most common browse tabs, never lost in a menu
4. **Single breakpoint** — one responsive breakpoint (`md:`, 768px) keeps the mobile and desktop layouts predictable

---

## Why the FAB Matters

The floating action button ("Get Help") appears on Browse and Commitments tabs. It's deliberately not on My Requests — if you're looking at your own requests, you probably already know you want to post one; the **New Request** button at the top of that tab is sufficient.

On Browse, the FAB is there because users who are browsing for others to help are also likely to have needs of their own. The mental state of "I'm here to help" and "I could also ask for help" overlap — the FAB bridges them without navigating away.

---

## Design Evolution

| Sprint | Change |
|--------|--------|
| Sprint 33 | Canonical design tokens, empty states, onboarding modal |
| Sprint 34 | Tab-based navigation, single-column content, FAB, filter chips |
| Sprint 35 | Wizard / "Type-first: one decision per screen" — 3-click rule, SpeedDialFab, Get Service CTA |
| Sprint 36 | Commitment depth (timeline, inline messaging) |
| Sprint 88–90 | "Warm commons" visual system — the `.kq-*` shell, Fraunces + Hanken type, relationship-led cards, finite "caught up" states, visible decay |
| Sprint 104 | Visual Design System v2 research — finish the warm system everywhere + harden it into tokens ([ADR-079](adr-079-visual-design-system-v2), proposed) |

---

## The Visual System: "Warm Commons" (v2 direction — proposed)

Karmyq should feel like a **stewarded neighbourhood library**, not a SaaS dashboard and not a social
engagement feed. Warmth is identity — people, stories, and the relationship reason for a connection
lead every surface, in a humane voice, on a cream page with a Fraunces serif for human moments. Calm
is discipline — finite queues that end with "you're all caught up", one quiet notification, no
engagement counters, and color used only to carry meaning (green = action, orange = urgency, teal a
sparing accent).

The system is backed by **CSS-variable design tokens** so the whole app re-skins from one place, and
each community can theme itself without breaking the shared structure. The direction for its next step
(ADR-079, proposed) is to **finish** the system — every surface speaks the same visual language — and
**harden it into tokens** so it can't drift again: one reading column, one card primitive (a hairline
border, not a drop shadow), a smooth serif type ramp, status and urgency drawn from semantic tokens,
one warm empty-state component, and a single quiet step toward more character (a whisper of paper-grain
texture and a recurring seed/leaf motif) — evolution of the warm system, never a replacement of it.

## 3-Click Rule (Sprint 35)

Every primary action — **Get Help** and **Get Service** — completes in exactly 3 interactions:

1. Tap the FAB (+ button)
2. Select a request type
3. Describe and submit

This rule prevents the friction that killed the original smart-text form. Each screen in the wizard asks for exactly one decision. The type picker is a visual grid, not a dropdown. The description is a plain textarea, not an annotated input. Urgency is explicit, not inferred.

"Get Service" follows the same rule via the provider card or profile page: tap "Get Service" → the wizard opens at step 2 pre-filled with the provider's service type → describe and post.
