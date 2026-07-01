# Using the Service Provider Directory

Karmyq has two layers: the mutual aid layer (karma-based, gift economy) and the service provider layer (paid, professional). This guide covers the service provider directory.

---

## Finding a Provider

Go to **Service Providers** in the main navigation. You'll see two tabs:

- **Individuals** — solo providers (tutors, handypersons, drivers)
- **Collectives** — organizations of providers (rickshaw stands, cooperatives)

Filter by service type to narrow results. Each card shows a trust score badge, average star rating, and pricing notes.

**Trust score badge colors:**
- Green (80–100) — highly reliable, strong track record
- Blue (60–79) — solid completion rate
- Yellow (40–59) — newer provider, building reputation
- Gray (below 40) — limited history

Click a provider card to see their full profile: bio, ride details (if applicable), which collectives they belong to, and all reviews.

**Providers in your communities:** When you're signed in, the directory highlights providers you share a community with — they appear first under **"In your communities"** with a green "✓ In {community}" badge, ahead of **"Other providers."** This is the same community trust lens used for first-dibs and matching: a provider serves the communities they belong to. (Browsing logged out still shows the full public directory, just without the community grouping.)

---

## Becoming a Provider

1. Go to **Service Providers → Become a Provider**
2. Choose your service type (ride, tradesperson, tutor, or other)
3. Write a bio and set pricing notes (advisory only — Karmyq never processes payment)
4. For rides: add your vehicle type and typical routes
5. Submit — your profile is now visible in the directory

Your profile joins the neighborhood service directory. Members who share a community with you see you highlighted as "in your community" — the same trusted circles you already help through mutual aid. You can edit or deactivate your profile at any time from the provider detail page.

---

## Provider Collectives

A **collective** is an organization of providers — a rickshaw stand, repair cooperative, or tutoring group. Collectives can:

- Group multiple provider profiles
- Serve multiple communities
- Show a combined trust score across all members

**Joining a collective:** Find a collective in the Collectives tab, open its detail page, and click Join Collective (you need a provider profile first).

**Creating a collective:** Go to Service Providers → Collectives → Create Collective. Choose service types, write a description, and add location notes. As admin, you can link your collective to communities and manage members.

**Linking to a community:** From your collective's detail page, use Link to a Community. This makes the collective appear in that community's admin Providers tab.

---

## Community Settings

Community admins can configure provider integration under **Admin → Providers**:

- **Enable provider services** — toggles whether provider directory is highlighted to community members
- **Minimum trust score** — the floor personal trust score for providers visible to this community
- **Collectives serving this community** — shows linked collectives, with option to unlink

---

## Reviews and Trust

After interacting with a provider, you can leave a star rating and short review on their profile.

Provider trust scores are calculated from:
- **Stars (60%)** — average rating across all reviews
- **Completion rate (30%)** — did they finish jobs they started?
- **Response rate (10%)** — do they reply to inquiries promptly?

This is separate from the personal trust score used in mutual aid. A great provider does not need to have helped anyone move furniture.

---

## What Karmyq Handles (and Doesn't)

Karmyq is coordination infrastructure, not a marketplace. It handles finding providers and reading reviews. Pricing notes are advisory only — Karmyq never processes payment, handles booking, or arbitrates disputes. The relationship between provider and customer is theirs to manage.

---

## Are You a Provider?

If you offer services through Karmyq, check out [Using Provider Mode](provider-mode) — a dashboard view designed for providers that surfaces incoming requests matching your service type, your active commitments, and a separate notification stream for provider-specific alerts.

---

## Receiving Provider Offers

When a provider goes on duty and sees your open request, they can send you a direct offer — including their price and a personal note.

You'll receive a push notification when an offer arrives. You can also find all pending offers in the **Offers Received** section inside your **Commitments** tab. Each offer shows:

- The provider's name
- Their proposed price (or "Price TBD" if no price was set)
- Any personal note they added

## Accepting or Declining an Offer

From the Helping tab → Offers Received:

- Tap **Accept** to accept an offer. A match is created and the commitment appears in your Helping tab. The provider is notified immediately.
- Tap **Decline** to decline. The provider is notified and can offer on other requests.

You can receive multiple offers on the same request and accept the one that works best for you. Once you accept one offer, the request moves to matched status.

## Offering on Service Asks

When a service ask appears in the feed or on its detail page, the action reads **Offer service**.
Mutual-aid asks keep **Offer to Help**. Both actions use the same offer/match flow; the copy changes
only to keep provider/service requests legible as service work rather than neighbour help.

---

## Sending a Private Heads-Up (Dibs)

After creating any request, Karmyq may suggest a person you've worked with before — or someone you're connected with in your community — and offer to send them a private notification before the request goes public. This is called **dibs**.

**How it works (requester side):**

1. You submit a request (scheduled or ASAP).
2. A prompt appears: _"Send [Name] a private heads-up before this goes public?"_
3. Tap **Send Dibs** — the person is privately notified. Your request is not visible in the public feed yet.
4. They have a limited window to accept or decline:
   - **Scheduled requests**: 20% of your lead time
   - **ASAP requests**: 24 hours
5. If they accept, you're matched directly. If they decline or the window closes, the request automatically broadcasts.

**If no prompt appears:** no eligible candidate was found — no prior completed interactions and no community connection. The request posts publicly as usual.

See [Dibs: Trusted First-Ask Before Broadcasting](provider-dibs) for the full guide, including the provider side of the workflow.

## Seeing how you're connected (Sprint 116)

When a provider submits an offer, both sides now see a small, reciprocal relationship picture at the
moment help is considered. Before submitting, the provider sees how they connect to the requester;
when reviewing the offer, the requester sees the same topology plus the provider's service type and,
if they belong to one, their collective (for example "Marin Helping Hands"). Everyone is drawn as an
equal person node — being a provider is a role badge, never a bigger or higher-ranked dot. The picture
never blocks the offer: if it can't load, Submit / Accept / Decline still work exactly as before.
