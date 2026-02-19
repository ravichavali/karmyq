# Why Reputation Decays

In Karmyq, karma and trust scores decay over time when you're inactive. This is a deliberate design choice, not a bug.

---

## The Problem Decay Solves

Imagine a platform where reputation only ever grows. Someone joins early, does a lot of good work, then stops participating entirely. Years later, their reputation is still sky-high — higher than people who are actively helping every week.

This creates problems:

- **Past contributions crowd out present ones.** New, active members are undervalued.
- **Hoarding.** People accumulate reputation and sit on it.
- **Stale trust.** Someone who was reliable two years ago may not be reliable today.

Decay solves these problems by making reputation reflect your *current* relationship with the community, not just your history.

---

## How Decay Works

Karma and trust scores decay on a half-life model — similar to how radioactive decay works in physics.

A community with a **30-day half-life** means that after 30 days of inactivity, your score is half of what it was. After another 30 days, it's half again. The curve is gradual — you don't fall off a cliff after a week — but sustained absence has a real effect.

Communities configure their own decay rate:
- **Short half-life (15–30 days):** Fast-moving community that values recent activity.
- **Long half-life (90–180 days):** More forgiving of gaps in participation.

---

## What Counts as Activity

- Posting a request
- Completing a request
- Any meaningful community interaction

As long as you're actively participating, decay doesn't apply.

---

## The Philosophy: Active Contribution

Karmyq is built around the idea that communities are living things. We care more about who you are in the community right now than who you were.

Decay also levels the playing field — someone who joins a year after founding shouldn't be permanently behind early members forever.

---

## Decay is Recoverable

If your reputation has decayed because you've been away, you can rebuild it. The same actions that built your reputation in the first place will build it again.

Karmyq doesn't punish absence permanently. It just ensures that standing is earned through ongoing participation.
