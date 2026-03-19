# A Trust Model That Reflects Reality

How Karmyq's trust parameters calibrate based on lived experience — in either direction.

Karmyq's trust model has always been configurable per community. But trust isn't static — people change, communities learn, and a model that stays frozen at its initial settings drifts away from reality.

## The Core Principle

The trust evolution system calibrates toward accuracy, not toward any particular value. Higher cross-community trust is not better than lower cross-community trust. The correct model is the one that reflects what's real.

An accurate low-trust model is healthier than an inaccurate high-trust model. Trust grows on honest foundations.

## What Evolves

Three parameters can calibrate over time:

- **Depth weight** — how much repeat interactions with the same people contribute to your trust score
- **Breadth weight** — how much diverse interactions across many people contribute
- **Cross-community prior** — your starting trust assumption for people from other communities, before you have any shared history

The third is new. It's a Bayesian prior: the system's best guess about how you'll relate to a stranger from another community, based on your history with strangers from other communities.

## How It Calibrates

Five behavioral signals nudge parameters based on what actually happens:

- Positive cross-community feedback → cross-community prior calibrates upward
- Difficult cross-community feedback → cross-community prior calibrates downward
- Completed cross-community exchange → slight upward calibration
- Repeated help with same person → depth weight increases
- Help spread across 3+ communities in a month → breadth weight increases

Calibration is gradual — small steps, no rapid swings. Each parameter has a 7-day cooldown to prevent volatility.

## Opt-In

Evolution is disabled by default. Two switches must both be on:

1. The community admin enables trust evolution for the community
2. The individual member enables evolution for themselves

Both can be turned off at any time. Evolution history remains visible even when evolution is paused.

## Your Trust Journey

Every parameter adjustment is logged. You can view your full calibration history: what changed, what caused it, and by how much. The goal is transparency — your trust model should make sense to you, not feel like a black box.

## What Comes Next

In a future sprint, your calibrated model will influence what you see in your feed and how your requests are matched. The platform's behavior will emerge from the intersection of your personal model and your community's model — a fractal of the same trust mechanics operating at two scales simultaneously.
