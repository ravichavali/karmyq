# ADR-092: AGPL-3.0-or-later, and the Manifesto Audit That Produced It

**Date**: 2026-08-07
**Status**: Accepted
**Deciders**: Ravi Chavali (maintainer)
**Related**: [ADR-041](ADR-041-two-layer-mutual-aid-services.md) ·
[ADR-082](ADR-082-reputation-disclosure-boundary.md) ·
[ADR-091](ADR-091-verification-before-assertion.md) ·
[ADR-093](ADR-093-federation-schema-reserved.md) · Sprint 123

## Context

Karmyq's public manifesto at karmyq.org makes a specific promise: *"Every line of code is public.
Fork it, improve it, make it yours. The infrastructure for cooperation should belong to everyone —
and the AGPLv3 license keeps it that way. If someone runs Karmyq, their changes stay open too."*

Sprint 123 was preceded by an audit that read every load-bearing manifesto claim back to source.
The audit's headline finding was that **this particular claim was not true**, and not in the mild
way the phrase usually means.

### F1 — The repository made contradictory license claims, and had no license at all

| Where | Claimed |
|---|---|
| `apps/landing/src/components/Footer.tsx:26`, `apps/landing/src/lib/landingContent.ts:278` | **AGPLv3** |
| `README.md:4` (badge, linking to a file that did not exist), `README.md:164` | **MIT** |
| `CONTRIBUTING.md:52` — *the live contributor agreement* | **MIT** |
| `apps/mobile/README.md:363` | AGPL-3.0, linking to the same missing file |
| Seven service READMEs — `auth`, `cleanup`, `community`, `messaging`, `notification`, `reputation`, `request` | **MIT** |
| `services/simulation-service/README.md:347` | **"Internal use only - Karmyq Platform"** |
| All 20 tracked `package.json` manifests | silent — no `license` field |
| `git ls-files` (whole tracked tree, `-i` on `license\|copying\|agpl`) | **no LICENSE file** |
| `gh repo view --json licenseInfo` (2026-08-06) | **`null`** |

The repository is **public** (`isPrivate: false`, verified 2026-08-07), so every one of those
contradictory claims was readable by anyone. That is the reason they mattered, and it is the only
claim about exposure this ADR makes — see *Observables* below.

With no license file, default copyright applied and no grant had been made. Publishing AGPL is
therefore a **licensing decision creating a new legal grant**, not a documentation fix.

Two of the fourteen sites deserve separate mention, because of *how* they were found:

- The **seven service READMEs** were missed by the first version of the sprint spec, whose scan was
  piped through `| head -60`. They were the majority of the MIT claims in the repository.
- The **simulation-service** claim (*"Internal use only"*) was missed by both the audit and the
  sprint plan, because every search used the tokens `MIT` and `AGPL` and this claim contained
  neither. It was found only by reading the three READMEs that were believed to have no License
  section at all. A search is only as complete as its vocabulary.

### The manifesto audit, in full

**2.1 — Nine claims that hold** (each traced to `file:line`):

| Claim | Evidence |
|---|---|
| "six-month half-life" | Exact. `HALF_LIFE_MS = 6 * 30 * 24 * 60 * 60 * 1000`, `Math.pow(0.5, age / HALF_LIFE_MS)` — `services/reputation-service/src/services/karmaService.ts:332,342` (ADR-011) |
| "~150 members" / Dunbar boundary | Hard-enforced; rejected above 150 with an error naming Dunbar — `services/community-service/src/routes/communities.ts:384,401-402` |
| "karma is not visible between members" | **Stronger than claimed.** ADR-082: five disclosure classes, `.strict()` Zod projections, `community_aggregate` needs a ≥5 distinct-member cohort, **no administrator exception**; the leaderboard was retired to HTTP 410 — `services/reputation-service/src/routes/reputation.ts:199-203` |
| "votes are weighted by trust" | `prestige_weight` persisted on both vote tables (`fusionsDb.ts:66`, `splitsDb.ts:101`); weighted tally at `routes/fusions.ts:32` |
| Communities can split **and** merge | `services/community-service/src/database/{splitsDb,fusionsDb}.ts`, `routes/fusions.ts` |
| "the pattern of your acts quietly shapes the connections the system makes" | `repeat_interaction_same_person → depth_weight +0.01`; `diverse_community_interactions → breadth_weight +0.02` — `services/reputation-service/src/services/trustEvolutionService.ts:56-60` |
| "details expire … what persists is the shape of your relationships" | `memoryRetentionJob.forgetExchangeContent()` anonymizes aged free text in one atomic CTE (ADR-069); `social_graph.trust_edges` persist independently |
| "Karmyq never touches the money" | **Negative, scope stated:** case-insensitive search for `stripe\|paypal\|payment_intent\|checkout_session` over `services/`, `apps/frontend/src`, `apps/landing/src`, `packages/` at `e457e3b2` — zero matches. *Not checked: transitive dependencies, or integrations outside the repo* |
| "No ads · No tracking" | **Negative, scope stated:** analytics/tag-manager token scan over `apps/landing/src` and `apps/frontend/src` plus a dependency-name scan of both manifests at `e457e3b2` — zero true matches. *Not checked: server-side logging, nginx access logs, deploy-time script injection* |

**2.2 — Claims that fail:** F1 (above, closed by this ADR), plus two handed to Sprint 124 with
their open questions intact:

- **F2** — *"You cannot arrive and immediately offer paid work. You have to earn standing first."*
  False as stated. `POST /requests/providers`
  (`services/request-service/src/routes/providers.ts:352-359`) runs `authMiddleware`, validates only
  that `service_type` and `display_name` are non-empty, then inserts. **But the conflict is the
  manifesto contradicting ADR-041**, not code drifting from its ADR: ADR-041:53 deliberately
  specifies open self-registration, and locates "earn standing" at
  `provider_min_personal_trust_score` — a threshold on *appearing within a community*, not on
  *creating a profile*.
- **F3** — ADR-041's community visibility policy shipped configured but unenforced.
  `provider_services_enabled`, `provider_min_personal_trust_score` and `provider_services_list` are
  read and written only by `services/community-service/src/routes/config.ts:58,209,240` and consulted
  by no service, package or frontend path. Worse, the toggle is **exposed to community admins** at
  `apps/frontend/src/components/community/tabs/ProfileTab.tsx:342` — admins operate a control that
  does nothing.

**2.3 — Built but never claimed (reverse audit):** the `federation` schema is unimplemented
scaffolding (→ [ADR-093](ADR-093-federation-schema-reserved.md)); a public unauthenticated provider
directory ranked `trust_score DESC` exists (`providers.ts:27,62`) — permitted by ADR-082's
`provider` disclosure class, so not a privacy violation, but it is the most marketplace-shaped
surface in the system and *"It is not a marketplace"* does not acknowledge it; collectives, dibs,
activity scheduling and feedback are all shipped and absent from the public story.

### Provenance — a maintainer attestation

`git log --all` at `751e019f` (2026-08-07):

| Identity | Commits | Status |
|---|---|---|
| `Ravi Chavali <ravichavali@gmail.com>` | 1,474 | Maintainer |
| `Ravi Chavali <ravichavali@users.noreply.github.com>` | 107 | Maintainer (GitHub noreply) |
| `Pallavi Ravi <kompella.chavali@gmail.com>` | 24 | Maintainer — alternate address (**attested**) |
| `kompellachavali <kompella.chavali@gmail.com>` | 2 | Same address, different name string |
| `Karmyq Developer <karmyq@example.com>` | 12, incl. initial commit `1dea32d1` | Maintainer — pre-config identity (**attested**) |
| `dependabot[bot]` | 69 | Mechanical manifest/lockfile edits — not authorship |

**Sole human author: 1,619 commits across five identities**, collapsed by a `.mailmap` added in this
sprint (`git shortlog -sne --all` now reports one human author + dependabot).

⚠️ **This is recorded as a maintainer attestation, because that is what it is.** The repository
cannot prove which email addresses belong to one person; the maintainer can, and did, on 2026-08-07.
Naming the source of the fact is accuracy, not hedging. It is also sufficient: with no third-party
contribution, no consent is required and relicensing is unproblematic.

### Observables, stated at observed strength

`forkCount: 0`, `stargazerCount: 0`, `watchers: 0` (verified 2026-08-07).

**These do not prove that nobody obtained the code.** Clones and tarball downloads are not visible
in those counters and the repository is public. The correct statement is: *no GitHub-native forks,
stars or watchers were observed on 2026-08-07; clones and downloads are not observable.* This ADR
deliberately claims nothing stronger — the earlier draft's "no third party has ever received the
code" was unsupportable.

## Decision

**Karmyq is licensed AGPL-3.0-or-later.**

| # | Decision | 2026-08-07 |
|---|---|---|
| D7 | The project is **AGPL** | |
| D8 | The SPDX id is **`AGPL-3.0-or-later`** — the FSF's recommended "or any later version" form | |
| D9 | The copyright line is **`Copyright (C) 2025-2026 Ravi Chavali`**, placed in `README.md`, **not** in `LICENSE` | |
| D10 | **All 20 tracked manifests** declare the license, discovered via `git ls-files` | |
| D11 | **Sole authorship**, per the attestation above — no consent needed, relicensing unproblematic | |
| D13 | The 7 UNVERIFIED audit claims are recorded here as follow-up, not checked this sprint | |

### Why AGPL and not MIT

Network copyleft is the *only* mechanism that makes the manifesto's own sentence true. MIT permits
a company to run a modified Karmyq as a hosted service and never publish the modifications —
"if someone runs Karmyq, their changes stay open too" would simply be false under MIT. The
manifesto is not decoration; it is a promise about what happens to the commons. AGPL §13 is what
keeps it. Choosing MIT would have meant editing the manifesto to say less.

`-or-later` follows the FSF's recommendation, so a future AGPLv4 can be adopted without tracking
down every rightsholder — cheap now, and D11 means there is exactly one rightsholder to track down
today anyway.

### The durable output is the gate, not the LICENSE file

The `LICENSE` file was fifteen minutes of work. What prevents recurrence is
`tests/regression/sprint-123-license-consistency-gate.test.ts`, which reads all sixteen prose claim
sites and all twenty `git ls-files`-discovered manifests, normalizes each to a license family, and
fails on **disagreement**, on a **null extraction**, and on any **new unallowlisted claim**.

The distinction matters and is the whole point: a gate asserting "a LICENSE file exists" would have
passed happily through the entire contradiction this ADR exists to end. Per ADR-091, every one of
the sixteen extractors is separately proven able to return `MIT` and `null` — one injection proves
one extractor, not a gate — and the gate was **observed red** on a real on-disk flip before being
trusted.

## Consequences

### Positive

- The manifesto's central claim about the commons becomes true rather than aspirational.
- One license statement, in sixteen places plus twenty manifests, machine-enforced to agree.
- GitHub detects the license (`licenseInfo != null`), which is why `LICENSE` is byte-exact
  canonical text with nothing appended — GitHub's detection is similarity-based.
- Contributors are told the truth by `CONTRIBUTING.md` at the moment they contribute.
- The audit is recorded once instead of being re-derived in three months.

### Negative

- AGPL deters some commercial adopters. That is the intended trade: the point of network copyleft
  is that the commons is not a free input to a closed service.
- Every new `package.json` must declare the license or the gate fails. This is intended friction;
  it is also the cheapest possible fix (one line).
- The gate's sixteen extractors are regex-coupled to prose wording. A rewrite of any License
  section turns the gate red. This is **by design** — a null extraction is a failure, not a skip —
  but it means rewording is a two-file change.

### Neutral

- `LICENSE` carries no project notice; the copyright line lives in `README.md`, per GNU's
  `gpl-howto` (attach notices to the program, not to the license text).
- `.gitattributes` pins `LICENSE` to `eol=lf` so `core.autocrlf=true` cannot check it out with CRLF.
- A `.mailmap` now collapses the five maintainer identities. It changes no history, only display.

## Alternatives Considered

### MIT — keep the README, edit the manifesto

Simplest, maximal adoption, and the README/CONTRIBUTING claims would have needed no change.
**Rejected:** it resolves the contradiction by making the public promise smaller. The manifesto is
the spine of the project (arc-design D1); the code should meet it, not the reverse.

### AGPL-3.0-only rather than `-or-later`

Pins the exact license text forever, with no automatic adoption of a future version.
**Not chosen:** the FSF recommends `-or-later`, and with a single rightsholder the migration cost
`-only` protects against is not a cost worth carrying.

### Append the copyright notice to `LICENSE`

The obvious-looking placement. **Rejected:** GitHub's license detection is similarity-based, a
modified `LICENSE` can defeat it, and `licenseInfo != null` is a Definition-of-Done item for this
sprint. GNU's `gpl-howto` puts notices on the program anyway.

### `"private": true` on the ten service manifests instead of a license field

Offered during planning and **not chosen** — recorded here so it is visibly a decision rather than
an oversight. All twenty manifests are first-party Karmyq code in a public AGPL repository; a scope
defined as "npm workspaces only" would have left `scripts/`, `tests/e2e/`, `tests/load/` and
`tests/performance/` silent for no reason a reader could infer.

### A gate that checks the `LICENSE` file exists

**Rejected explicitly.** It is the failure mode, not the fix. See *The durable output* above.

## Implementation Notes

- `LICENSE` — canonical GNU AGPL v3 fetched from `https://www.gnu.org/licenses/agpl-3.0.txt`
  (662 lines, 34,523 bytes, sha256 `0d96a4ff…`), byte-exact, nothing appended. The gate asserts the
  hash over LF-normalized bytes.
- `tests/regression/sprint-123-license-consistency-gate.test.ts` — the gate. It discovers manifests
  with `execFileSync('git', ['ls-files', …])` rather than `execSync` with a quoted glob: on Windows
  `execSync` routes through `cmd.exe`, which does not strip single quotes, so the pattern reaches
  git as a literal and matches nothing — a silently-empty list that would have made the manifest
  assertion vacuously false-green on the maintainer's machine.
- Ten service READMEs now carry an **identical** License section. Uniform beats conditional: "every
  service README states the license" is enforceable; "those that have a section must agree" is the
  weaker shape this repo keeps getting caught by.
- `services/registry.json` unchanged; no endpoint, schema, event or migration in this sprint.

### Follow-up: the 7 UNVERIFIED claims (D13)

Surfaced by the audit, **not** traced to source. Neither holding nor failing — do not cite them
either way until read.

| # | Claim | The search that would settle it |
|---|---|---|
| 1 | "Every completed interaction generates karma for **both** people" | Read `karmaService` award paths on `match_completed`; check whether both `helper` and `requester` receive a record |
| 2 | "When you join somewhere new, a portion of what you've built elsewhere doesn't disappear" | A `cross_community_prior` parameter exists; trace whether any code path applies it on join |
| 3 | "To be nominated for a governance role, a member must first earn standing" | `governance` schema nomination routes — look for a trust/karma floor |
| 4 | "A role-holder whose presence has faded can be replaced" | Same routes — look for an inactivity-triggered vacancy path |
| 5 | "The platform reads the existing patterns of interaction and suggests who belongs together" | Split *machinery* is verified; the **suggestion algorithm** is not — find what proposes a split, if anything |
| 6 | "no platform override" on community rules | Search for any admin/superuser bypass of community config |
| 7 | Whether the `reputation_disclosure` registry entry for the retired leaderboard is deliberate or stale | Compare `services/registry.json` against the HTTP 410 route |

**Runtime-UNVERIFIED (a separate class — deployment code is not a running process):** whether the
simulation service is currently running on the demo server, and whether `reset:demo`'s real
(non-dry-run) path restores a known baseline. Both belong to Sprints 125–126.

## References

- GNU AGPL v3 — <https://www.gnu.org/licenses/agpl-3.0.txt>
- GNU "How to use GNU licenses for your own software" — <https://www.gnu.org/licenses/gpl-howto.html>
- Sprint 123 spec — `docs/superpowers/specs/2026-08-07-sprint-123-licensing-and-audit-design.md`
- Arc design (the audit in full) — `docs/superpowers/specs/2026-08-06-sprint-123-126-manifesto-alignment-arc-design.md` §2
- [ADR-091: Verification Before Assertion](ADR-091-verification-before-assertion.md) — why one
  injection is not proof
