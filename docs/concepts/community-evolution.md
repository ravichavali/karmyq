# Community Evolution

Karmyq communities don't have fixed trust configurations. Over time, they learn from their members.

## How It Works

When members' individual trust models calibrate based on lived experience, those calibrations become a signal. The Community Evolution Engine aggregates these signals into periodic nudges to the community's trust config.

## What Evolves

Three parameters evolve over time:
- **Cross-community prior**: how openly the community treats interactions with outsiders
- **Karma split**: the balance of karma awarded between helpers and requesters
- **Trust path depth**: how many relationship hops the community considers when computing trust

## The Core Mechanic

Each member's evolution is tracked as a delta — the change from their starting values. A community where members are consistently calibrating toward more openness tells the system something real. The community config nudges in that direction.

## Interaction Health Check

Before applying any evolution, the system checks whether interaction rates are declining. If they are, the nudge is dampened or skipped. This prevents the system from drifting toward configurations that correlate with disengagement.

## Opting Out

Both communities and individual users can opt out. Community admins can pause evolution from the Settings tab. Users can disable personal trust evolution from their Trust settings — doing so also stops their signal from contributing to community evolution.
