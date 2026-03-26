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

## Admin Tab Structure

The community admin page is organized into **five tabs**. The tabs you see depend on your role:

| Tab | Visible to |
|-----|------------|
| **Overview** | All members |
| **People** | Admins and moderators |
| **Requests** | Admins and moderators |
| **Providers** | Admins and moderators |
| **Settings** | Community admins only |

---

## People Tab (Members + Norms)

The People tab consolidates member management and community norms in one place.

Use the **sub-toggle** at the top of the tab to switch between two views:

- **Members** — Browse all current members, see their karma and trust scores, and manage roles
- **Norms** — An accordion of your community's stated norms, values, and conduct expectations

This keeps community culture and membership in context with each other, since a community's norms define the expectations its members are held to.

---

## Requests Tab (Requests + Insights + Admin Actions)

The Requests tab is the primary tool for admins who play an active role in matching and facilitation.

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
4. The proposed member sees the request appear in their Commitments tab under **"Needs Your Response"**
5. They can accept or decline — it's always their choice

This is the key tool for high-touch facilitation. It doesn't force anyone into anything; it surfaces the opportunity where the proposed helper will see it.

---

## Acting as a Connector

Admins don't just maintain a community — you connect people. These two tools are your primary instruments for active facilitation.

### Spotlight a Request (Boost)

Click the ⚡ Boost button on any open request in the Requests tab. The request rises in member feeds with a "Community Pick" badge for 48 hours. Use this for requests that need urgent community attention — a member in a difficult situation, a time-sensitive need, or a request that's been waiting too long.

### Suggest a Helper (Propose a Match)

Click **Propose a Match** on any open request. Select a community member from the picker. They'll see "Suggested by your community admin" in their Commitments tab and can Accept or Decline the suggestion. You're surfacing the opportunity — the decision stays with them.

### When to Use Each

**Boost** = surface the need. You want more people to see this request and self-select to help.

**Propose** = connect the people. You have a specific person in mind and want to make a direct introduction.

These tools work best when used with intention. Boosting everything dilutes the signal. Proposing works because it's personal — use it when you have a genuine reason to think a specific person is the right fit.

---

## Providers Tab

Browse the service providers who have listed themselves in your community. Useful for recommending vetted providers to members who post service requests.

---

## Settings Tab (Community Settings + Trust Configuration)

The Settings tab consolidates all community configuration in one place — previously split across a separate Config tab and other locations.

### Location & Discovery

Set your community's geographic coordinates and interest tags. These control how your community appears on the [community discovery page](/docs/guides/finding-communities):
- **Location** — latitude/longitude used for distance sorting in geography mode
- **Tags** — interest chips members can filter by (stored lowercase, e.g., `tool-sharing`, `elderly-care`)

### Community Configuration

Access the trust model questionnaire and all configuration parameters:

**Revisiting Your Trust Model**

As your community matures, you can revisit the questionnaire at any time:
1. Open your community → **Settings** tab
2. Click **Revisit trust model**
3. Answer the six questions reflecting your community as it is now
4. Review the diff: see exactly which fields would change, with current and proposed values
5. Apply all changes, apply only selected fields, or discard

### Request Types

Choose which types your community supports. Enable or disable:
- General Help, Rides, Services, Events, Borrowing

For each enabled type, set a **karma multiplier** — how much karma helpers earn. Use multipliers to signal which kinds of help your community values most.

**Custom types:** If your community has specific needs, create custom types via the **Schema Manager** linked from the Settings tab.

### Karma Mechanics

- **Split (helper/requestor):** How karma is divided between helpers and people who ask
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
