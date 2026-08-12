# Time-boxed exemptions

A good automated gate knows how to say **no**. A trustworthy gate also needs a narrow, visible way
to say **yes, deliberately** when the facts do not fit a simple rule.

Without that path, teams usually choose between two bad outcomes. They weaken the gate for
everything, or they leave it permanently red until everyone learns to ignore it. Either way, a new
problem becomes harder to see.

## An exemption is a decision, not a bypass

Karmyq keeps exemptions in reviewed registries alongside the code. Every entry names the exact
thing being allowed and records:

- what differs;
- why accepting it is safe enough;
- who owns the decision;
- when the decision was made; and
- what event makes it expire.

Wildcards are deliberately absent. Allowing one advisory does not allow every advisory on that
package. Allowing Jest to differ from Expo's recommendation does not allow every mobile dependency
to drift.

The gates also reject stale entries. If an upstream fix arrives or the versions converge, the old
entry makes the gate red until it is removed. The registry is therefore a list of live decisions,
not a graveyard of old exceptions.

## Two clocks for two kinds of risk

The dependency security gate uses a **calendar clock**. A high-severity advisory with no available
fix can be exempted for no more than seven days. That short window matches Karmyq's remediation SLA
and forces a fresh check of the upstream facts. Critical findings can never be exempted.

The Expo compatibility gate uses a **generation clock**. A deliberate departure from Expo's
recommended package versions is valid only for the Expo SDK major recorded with it. Moving the
mobile app to the next SDK expires the decision and requires the team to argue it again against the
new compatibility map.

These clocks differ on purpose. A security finding should not wait for a future platform upgrade,
and a stable toolchain choice should not require a ritual weekly renewal. The trade-off is explicit:
an Expo divergence can remain for a long time while the app stays on the same SDK generation.

## The live source still decides

An exemption never replaces the real check. Karmyq still runs `npm audit` and Expo's live
compatibility command, then subtracts only exact, current registrations. New findings remain red.
Malformed registries, expired decisions, output the gate cannot fully understand, and entries that
no longer match reality all fail closed.

That is the principle: make exceptional decisions legible and temporary on the clock that fits
their risk, so the ordinary signal stays worth listening to.

The technical contract is recorded in
[ADR-094: Generalized Exemption Registries](/docs/concepts/adr-094-generalized-exemption-registries).
