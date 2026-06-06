# Running a Community

As a community founder, you shape the environment your members live in.

---

## Creating a Community

1. From your dashboard, click **Create Community**
2. Give it a name and description — be clear about who it's for
3. If you want a pre-configured starting point, choose a template — otherwise proceed to the trust model questionnaire
4. **Answer six questions** about how your community thinks about trust and relationships — the system infers config parameters from your answers
5. Review and customize in the config editor (optional — click "Skip & Create" to go straight through)
6. Publish

See [Setting Your Community's Trust Model](/docs/guides/community-trust-model) for a full explanation of each question and what it controls.

---

## The Community Page (warm four-tab model)

As of Sprint 89 ([ADR-068](/docs/concepts/adr-068-community-page-information-architecture)), the
community page opens as a *neighbourhood*, not a console — and **everyone, admins included, lands on
the warm Home tab**, not on a management view. A community is [a place you belong to](/docs/concepts/community-home),
and running it lives one altitude down.

| Tab | What's there | Visible to |
|-----|--------------|------------|
| **Home** (default) | The warm hero (with the Dunbar cap bar), the weekly **"this week in the neighbourhood" pulse**, and the open asks members can help with | Everyone |
| **People** | Members + their trust, and your community's norms | Everyone |
| **How we're connected** | The community trust graph | Members |
| **Stewardship** | Decisions, Split, Fusion (all members) + the admin **Steward requests** manager, **Settings**, and **Providers** (admins) | Members; admin tools gated within |

Group communities also see an **Activities** tab.

> **Where management moved.** The old `Requests`, `Settings`, and `Providers` admin tabs now live as
> sub-sections **inside Stewardship**. Everything below still works exactly as before — it's reached
> via *Stewardship → Steward requests / Settings / Providers* instead of its own top-level tab. Old
> deep links (`?tab=requests`, `?tab=settings`, …) redirect into the new model automatically.

### The weekly pulse

Home replaces the old empty KPI tiles with an honest weekly summary: how many neighbours helped each
other, how many open asks are waiting (and how many are time-sensitive), and who recently joined.
Rows with nothing to report are hidden rather than shown as "0". The same numbers power the in-feed
activity card — there's one source of truth, so the pulse and the feed never disagree.

---

## People (Members + Norms)

The People tab consolidates member management and community norms in one place.

Use the **sub-toggle** at the top of the tab to switch between two views:

- **Members** — Browse all current members, see their karma and trust scores, and manage roles
- **Norms** — An accordion of your community's stated norms, values, and conduct expectations

This keeps community culture and membership in context with each other, since a community's norms define the expectations its members are held to.

---

## Stewardship → Steward requests (Requests + Insights + Admin Actions)

The **Steward requests** sub-section of Stewardship is the primary tool for admins who play an active
role in matching and facilitation.

### Summary Cards

At the top of the Requests tab, summary cards give you a snapshot of community health:
- Open requests (waiting for help)
- In-progress matches (active exchanges)
- Completed exchanges this week

### Browsing Requests

Below the summary, you can browse all requests in your community:
- Filter by status: Open, Pending, Matched, Completed
- See who requested, what they need, and when

### Admin Actions

Each request card in the admin view has three additional actions that regular members don't see:

**Boost** (⚡)
Boosts a request's visibility in the feed for 48 hours. Boosted requests show a ⚡ badge and receive a +0.3 increase to their feed score, making them more likely to surface for potential helpers. Use boost for requests that have been waiting a long time or come from vulnerable members.

**Mark Urgent**
Flags a request as community-urgent priority. Urgent requests are visually distinguished and sorted higher. Use this sparingly — if everything is urgent, nothing is.

**Propose a Match**
Allows you to connect a specific member to a request. When you propose a match:
1. Select the member you think can help
2. Confirm the proposal
3. A real match record is created in the system with `proposed` status
4. The proposed member sees the request appear in their Helping tab under **"Needs Your Response"**
5. They can accept or decline — it's always their choice

This is the key tool for high-touch facilitation. It doesn't force anyone into anything; it surfaces the opportunity where the proposed helper will see it.

---

## Acting as a Connector

Admins don't just maintain a community — you connect people. These two tools are your primary instruments for active facilitation.

### Spotlight a Request (Boost)

Click the ⚡ Boost button on any open request in Stewardship → Steward requests. The request rises in member feeds with a "Community Pick" badge for 48 hours. Use this for requests that need urgent community attention — a member in a difficult situation, a time-sensitive need, or a request that's been waiting too long.

### Suggest a Helper (Propose a Match)

Click **Propose a Match** on any open request. Select a community member from the picker. They'll see "Suggested by your community admin" in their Helping tab and can Accept or Decline the suggestion. You're surfacing the opportunity — the decision stays with them.

### When to Use Each

**Boost** = surface the need. You want more people to see this request and self-select to help.

**Propose** = connect the people. You have a specific person in mind and want to make a direct introduction.

These tools work best when used with intention. Boosting everything dilutes the signal. Proposing works because it's personal — use it when you have a genuine reason to think a specific person is the right fit.

---

## Stewardship → Providers

Browse the service providers who have listed themselves in your community. Useful for recommending vetted providers to members who post service requests.

---

## Stewardship → Settings (Community Settings + Trust Configuration)

The **Settings** sub-section of Stewardship consolidates all community configuration in one place — previously a separate top-level tab.

### Location & Discovery

Set your community's geographic coordinates and interest tags. These control how your community appears on the [community discovery page](/docs/guides/finding-communities):
- **Location** — latitude/longitude used for distance sorting in geography mode
- **Tags** — interest chips members can filter by (stored lowercase, e.g., `tool-sharing`, `elderly-care`)

### Community Configuration

Access the trust model questionnaire and all configuration parameters:

**Revisiting Your Trust Model**

As your community matures, you can revisit the questionnaire at any time:
1. Open your community → **Stewardship → Settings**
2. Click **Revisit trust model**
3. Answer the six questions reflecting your community as it is now
4. Review the diff: see exactly which fields would change, with current and proposed values
5. Apply all changes, apply only selected fields, or discard

### Request Types

Choose which types your community supports. Enable or disable:
- General Help, Rides, Services, Events, Borrowing

**Enforcement:** When you configure enabled request types, the platform enforces them. Members who try to post a request type not on your list will receive a clear error. Communities with no configured types accept all types — enforcement is opt-in.

For each enabled type, set a **karma multiplier** — how much karma helpers earn relative to the base pool. A multiplier of `1.5` means helpers earn 50% more karma for that type than usual. Use multipliers to signal which kinds of help your community values most (e.g., set a higher multiplier for rides or childcare to incentivize underserved needs).

**Custom types:** If your community has specific needs, create custom types via the **Schema Manager** linked from the hero and from Stewardship → Settings.

### Karma Mechanics

- **Split (helper/requestor):** How karma is divided between helpers and people who ask
- **Karma multipliers by request type:** Applied automatically when a match completes — the base karma pool is scaled by the multiplier for that request type before distribution
- **Decay rate (half-life):** How quickly reputation fades during inactivity

### Trust Mechanics

- **Depth vs. breadth:** Whether trust comes from repeated interactions with few people or many interactions across the community
- **Max trust hops:** How many degrees of separation the system considers

### Membership

- **Member cap:** Maximum size (default 150)
- **Visibility:** Public, Members Only, or Hybrid
- **Join approval:** Whether you must approve new members manually

### Onboarding

- **Karma lockout period:** How long before new members can earn karma
- **Request approval:** Whether new member requests need moderator review before appearing

---

## Community Trust Score

Your community has a public trust score (0–100) visible on the community discovery page. This reflects the quality and depth of exchanges in your community — not just how many members you have. Communities with consistent, well-reviewed exchanges build higher trust scores over time.

The score is calculated from member trust signals and updated periodically. You cannot set it manually; it reflects what actually happens in your community.

---

## Setting the Right Culture

**Participate yourself.** Founders who actively help build trust and model the behavior they want to see.

**Welcome new members.** A short personal message to someone who just joined goes a long way.

**Use admin tools judiciously.** Boosting every request or marking everything urgent dilutes the signal. Reserve these tools for requests that genuinely need a nudge.

**Handle problems early.** Address issues before they affect the community's trust in each other.
