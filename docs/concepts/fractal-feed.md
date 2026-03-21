# Fractal Feed

Karmyq's feed is personalized to each member's evolved trust calibration. The same pool of requests appears differently to different users — ordered by a blend of skill match, trust distance, community relevance, and urgency, where the trust distance component is calibrated to each user's personal cross-community openness.

## How it works

Each user's trust model contains three parameters that evolve based on their interaction patterns:
- **Depth weight**: how much repeated relationships count in your trust score
- **Breadth weight**: how much diversity of connections counts
- **Cross-community prior**: your baseline trust toward people from other communities

When your cross-community prior is high (earned through positive cross-community interactions), you'll naturally see more requests from people outside your immediate community. When it's low, your feed skews toward your established network.

## Your evolved parameters

Visit your Trust Score page to see your current calibration. The parameters are read-only — they evolve automatically from your experiences, not from manual configuration. You can pause evolution globally if you prefer your model to stay fixed.

## The arc

The fractal feed is the third phase of a three-sprint arc (ADR-046):
1. **Individual trust evolution** — your personal params learn from your interactions
2. **Community evolution** — your community's model drifts from aggregate member patterns
3. **Fractal feed** — the feed uses both your individual calibration and your community's evolved model to rank what you see
