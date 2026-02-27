# Why Ratings Are Private

In Karmyq's mutual aid layer, the feedback you give after an exchange is **private** — it contributes to someone's trust score, but it's never shown to them, and it's never shown publicly.

This is unusual. Most platforms show you your ratings. Karmyq doesn't. Here's why.

---

## The Problem with Public Ratings

Public ratings create a feedback economy — and feedback economies have well-known failure modes:

**Inflation**: On most platforms, the average rating is 4.8 out of 5. Anything below 4.5 looks bad. The practical scale has collapsed from 5 points to 2. This happens because people don't want to "hurt" someone with a 3-star review, so they give 5 stars unless the experience was genuinely awful.

**Retaliation fear**: If ratings are mutual — you rate me, I rate you — both parties know a low rating might trigger a low rating in return. The result: everyone gives 5 stars and learns nothing.

**Gaming**: If you can see your score and who gave it, you can optimize for the score rather than the behavior. You can identify your critics. You can pressure people to change their feedback.

**Social pressure**: In a small community, rating your neighbor honestly is hard. Public feedback creates awkwardness that private feedback avoids.

---

## How Karmyq's Feedback Works

After a completed exchange, both the requester and helper are invited to leave feedback. Feedback is:

- **Private**: The recipient never sees the individual rating you gave
- **Aggregated**: Feedback contributes to a trust score, which is visible — but the components are not
- **Time-decayed**: Old feedback matters less than recent feedback

This means you can be honest without worrying about social fallout. If someone was unreliable, mark them as unreliable. The score will reflect it, but they won't know it was you.

---

## The Consent Angle

Showing someone their individual ratings — especially in a small community — raises a consent question: did the reviewer intend for their feedback to be identifiable?

In a community of 50 people, if only 3 people gave feedback last month and your score dropped, you can probably figure out who rated you poorly. True anonymity requires either a large enough pool or explicit design choices to protect it.

Karmyq's approach: the score is visible, the inputs are not. The signal gets through without exposing the source.

---

## The Exception: Provider Reviews

The professional services layer (Layer 2) works differently. Star ratings for paid providers are **public** — both the aggregate score and individual reviews.

Why the difference?

- Paid service providers need visible social proof to attract customers
- The relationship is commercial, not communal — the social dynamics of a small village don't apply
- Reviews are tied to specific matches (where possible), making them harder to fabricate
- Providers opted in to the public layer by creating a provider profile

Privacy is the right default for mutual aid between neighbors. Visibility is the right default for professional services to the public.

---

## What the Trust Score Actually Measures

Because feedback is private and aggregated, the trust score reflects **patterns of behavior**, not individual incidents:

- Someone who reliably follows through will have a high score
- Someone who occasionally cancels or leaves things incomplete will have a lower score
- One bad interaction in a long history has limited impact

The score is not a report card on any single exchange — it's a summary of someone's track record across all their exchanges. That's what makes it meaningful as a signal, and what makes private feedback the right foundation for it.
