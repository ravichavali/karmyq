# Dibs: Trusted First-Ask Before Broadcasting

When you create a request on Karmyq, you can privately notify one trusted community member before the request appears in the public feed. That person gets a limited window to accept or decline. If they accept, you're matched directly — no public broadcast, no competition. If they decline or the window expires, your request automatically goes public.

This is called **dibs**.

---

## How Dibs Routing Works

1. **Create any request** — scheduled or ASAP — using the + button.
2. **Karmyq checks for a trusted candidate** — someone you have at least one prior completed interaction with who is also in your community.
3. **Prompt appears** — if a candidate is found, you see: _"Send [Name] a private heads-up before this goes public?"_ The prompt shows their trust tier and prior interaction count.
4. **Send or skip** — tap **Send Dibs** to privately notify them, or **Skip** to post publicly immediately.
5. **They respond** — if they accept, you're matched. If they decline or the window expires, the request broadcasts automatically.

You can only send dibs to one person per request. Once an outcome is reached, the decision is final.

---

## The Dibs Window

The dibs window is how long the candidate has to respond before the request goes public automatically.

| Request type | Dibs window |
|---|---|
| Scheduled | 20% of lead time (time between posting and scheduled date) |
| ASAP / non-scheduled | 24 hours |

If no eligible candidate exists (no prior interactions in community), the dibs prompt is silently skipped and the request posts publicly.

---

## Where to Respond (Provider Side)

Open the **Commitments** tab. Dibs invitations appear under **"Dibs Invitations"** with a live countdown to expiry.

- **Accept** — matched directly. The request never enters the public feed. Karma flows normally on completion.
- **Decline** — the request broadcasts publicly immediately. You won't see it again unless it appears in the regular feed.
- **Do nothing** — the window closes, the request goes public automatically. You cannot accept after expiry.

See [Using Provider Mode](provider-mode) for provider-specific workflow details.

---

## What Makes Someone a Dibs Candidate?

For **service requests** (paid provider work): the candidate must have an active provider profile with availability on.

For **all other request types** (mutual aid, rides, events, borrows): anyone in your community is eligible under the two-tier selection below.

### Two-Tier Candidate Selection (Explore / Exploit)

Karmyq selects dibs candidates using a fallback system:

**Tier 1 — Prior interactions (exploit):** Anyone in your community with at least one completed interaction with you who is available. This tier is always preferred.

**Tier 2 — Trusted new connections (explore):** If no Tier 1 candidates exist, Karmyq looks for community members with a direct exchange connection in the trust graph but no prior interactions. Community-only connections don't qualify — only people who have a completed exchange relationship with someone in your trust network.

In both cases, the candidate with the highest combined trust score and interaction history is suggested.

### Trust Context in the Prompt

The dibs prompt now shows live context instead of a static label:

- **"2 prior exchanges · direct connection"** — known relationship, direct trust link
- **"1 prior exchange"** — known relationship, no trust graph data
- **"New connection · direct connection"** — explore-tier candidate, first contact
- **"New connection"** — no prior history, no direct trust link (rare fallback)

The trust score shown in the prompt reflects the candidate's actual reputation score in your community, not a default value.

---

## Trust path

When reviewing a dibs candidate, you'll see how you're connected to them through your exchange network. For example, "You → Jordan → Alice" means Jordan has exchanged help with both you and Alice — Alice comes recommended through a shared connection, not as a stranger.

- **Direct connection**: You and this person have exchanged help before.
- **2° connection**: You share a mutual exchange partner.
- **3° connection**: You are three exchanges apart in the network.

The path updates as your network grows. If no path is shown, the candidate was selected through a direct social-graph connection even without prior exchanges.
