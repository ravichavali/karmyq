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

## Community Configuration

Access configuration from the **Config** tab in your community (founder only).

The trust model questionnaire pre-fills all parameters when you create the community. You can always edit individual values directly in the config editor for fine-grained control.

### Revisiting Your Trust Model

As your community matures, the answers that made sense at the start may no longer fit. You can revisit the questionnaire at any time:

1. Open your community → **Config** tab
2. Click **Revisit trust model**
3. Answer the six questions reflecting your community as it is now
4. Review the diff: see exactly which fields would change, with current and proposed values
5. Apply all changes, apply only selected fields, or discard

This makes it easy to evolve your trust model gradually without touching every setting.

---

### Request Types

Choose which types your community supports. Enable or disable:
- 🤝 General Help, 🚗 Rides, 🔧 Services, 📅 Events, 📦 Borrowing

For each enabled type, set a **karma multiplier** — how much karma helpers earn. Use multipliers to signal which kinds of help your community values most.

**Custom types:** If your community has specific needs (dog walking, language exchange), create custom types via the **Schema Manager** linked from your admin panel.

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

## Admin: Browsing Requests

From the **Requests** tab (admins only), you can browse all requests in your community:

- Filter by status: Open, Pending, Matched, Completed
- See who requested, what they need, and when
- Useful for high-touch communities where admins play an active matchmaking role — spotting needs and connecting requestors with potential helpers

---

## Community Trust Score

Your community has a public trust score (0–100) visible on the community discovery page. This reflects the quality and depth of exchanges in your community — not just how many members you have. Communities with consistent, well-reviewed exchanges build higher trust scores over time.

The score is calculated from member trust signals and updated periodically. You cannot set it manually; it reflects what actually happens in your community.

---

## Setting the Right Culture

**Participate yourself.** Founders who actively help build trust and model the behavior they want to see.

**Welcome new members.** A short personal message to someone who just joined goes a long way.

**Handle problems early.** Address issues before they affect the community's trust in each other.

---

## Provider Services

Some neighbourhoods contain people who offer services for pay — rickshaw drivers, handypeople,
tutors. Karmyq keeps that separate from the karma economy, but your community can choose to surface
those neighbours to its members.

**To turn it on:** Stewardship → Providers → *Enable provider services*.

This adds a **Providers** section to your community's Home for every member. It lists members who
have registered a provider profile and who meet two conditions you control.

### Minimum personal standing

A slider from 0 to 100. This is the member's **personal standing in your community** — how they
have shown up here — not their star rating as a provider. The two are different scores.

> ⚠️ **Someone with no standing here yet counts as 0.** Any value above 0 hides brand-new members
> until they build a track record. Set 0 (the default) if you want every provider in your community
> to appear.

### Service types allowed

Pick the service types your community wants to surface. **Selecting nothing means every type is
allowed** — this is the default, and it is not the same as "none". Use *Clear restriction* to
return to allowing all types.

### What enabling does NOT do

- It does not create provider profiles. Members register their own.
- It does not remove anyone from the platform-wide directory. Turning the switch off hides the
  section in your community; it does not touch anyone's profile or their visibility elsewhere.
- It does not gate who may register as a provider anywhere. Your settings control **reach into
  your community**, nothing more.

Members who are not part of your community cannot see this section at all.
