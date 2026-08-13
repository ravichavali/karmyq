# Sprints 123–127 — Manifesto Alignment & Demo Data Arc

**Date**: 2026-08-06
**Status**: Design agreed, not yet planned
**Author**: Claude (diagnosis chat), with maintainer decisions recorded inline
**Supersedes**: nothing. **Prerequisite**: ✅ satisfied — PR #195 merged (`e5dc24ce`, v11.42.0,
deployed and smoke-tested) and Sprint 122 archived. See §7.

> **ADR numbers below (092/093/094) are indicative.** ADR-091 was the highest at authoring
> time; claim the next free number when each is actually written.

> **Audit baseline: commit `e457e3b2`** (branch `fix/adr-060-gate-pr-head-ref`), 2026-08-06.
> Every static verdict below was read at that commit. Repository-wide **negative** claims
> ("no X anywhere") state their search method inline — a negative without a stated scope is
> not evidence. Claims about what is *running* are marked **runtime-UNVERIFIED** unless
> observed live on the server; deployment code proves a mechanism, not a running process.
>
> **Revised 2026-08-06 after external review** — eight findings, all CONFIRMED. The two that
> changed the framing: F3 was *not* architecturally blocked (§2.2), and `TimeTravelFactory`
> does *not* already satisfy the demo-backfill replay constraint (now §4, S126).
>
> **Revised 2026-08-13 after Sprint 124 shipped.** An urgent dependency-security and gate-truth
> sprint displaced the provider work originally numbered S124. The remaining arc moves one sprint:
> provider standing is S125, demo backfill S126, and live simulation S127. Sprint 125 begins with a
> security Task 0 for the still-unpatched `image-size` advisories and a weekly upstream check.

---

## 1. Why this arc exists

The maintainer opened this review with three threads: an architecture/product review
("are we on the right path?"), dissatisfaction with the seed data, and a request to check
the published manifesto at `karmyq.org` against what the code actually does.

The third thread turned out to be the spine. "Are we on the right path?" has no answer
without a stated destination, and `karmyq.org` is that destination, published. "Realistic
seed data" is undefinable until we know what the data must demonstrate.

So the review became a **bidirectional claim audit**: every public claim checked against
source, plus the reverse — shipped surfaces the public story never mentions.

### Headline result

**The product largely does what it says.** Nine substantive claims hold, several
implemented more rigorously than advertised. Every failure clusters in exactly one place:
**the paid-provider surface**, which shipped with marketplace mechanics but without the two
guardrails the manifesto promises.

The path is right. One surface walked ahead of the story.

---

## 2. The audit

Verdicts are traced to source. Anything not read directly is marked **UNVERIFIED** and must
be checked before being relied on.

### 2.1 Claims that hold

| Claim (verbatim, karmyq.org) | Evidence |
|---|---|
| "six-month half-life" | Exact. `HALF_LIFE_MS = 6 * 30 * 24 * 60 * 60 * 1000`; `Math.pow(0.5, age / HALF_LIFE_MS)` — `services/reputation-service/src/services/karmaService.ts:332,342` (ADR-011). A per-community `reputation_half_life_months` override exists (`services/cleanup-service/src/jobs/reputationDecayJob.ts:177`), which independently substantiates "communities set their own trust model". |
| "~150 members" / Dunbar boundary | Hard-enforced. Default `max_members = 150`; rejected above 150 with an error naming Dunbar's number — `services/community-service/src/routes/communities.ts:384,401-402`. |
| "karma is not visible between members. You cannot look up another person's score." | **Stronger than claimed.** ADR-082: five disclosure classes, `.strict()` Zod projections, `community_aggregate` requires a ≥5 distinct-member cohort, and explicitly **no administrator exception**. The competitive leaderboard was *retired to HTTP 410* in Sprint 112 (`services/reputation-service/src/routes/reputation.ts:199-203`). |
| "votes are weighted by trust" | `prestige_weight` persisted on both `communities.fusion_votes` and `communities.split_votes` (`fusionsDb.ts:66`, `splitsDb.ts:101`); weighted tally at `routes/fusions.ts:32`. |
| Communities can split **and** merge | Both real: `services/community-service/src/database/splitsDb.ts`, `fusionsDb.ts`, `routes/fusions.ts`. |
| "the pattern of your acts quietly shapes the connections the system makes" | `repeat_interaction_same_person → depth_weight +0.01`; `diverse_community_interactions → breadth_weight +0.02` — `services/reputation-service/src/services/trustEvolutionService.ts:56-60`. Consumed by `unifiedFeed.ts` and `dibsScoringService.ts`. |
| "details of an interaction expire after a few months … what persists is the shape of your relationships" | `memoryRetentionJob.forgetExchangeContent()` anonymizes aged free-text and cascade-forgets message content in one atomic CTE (ADR-069); `social_graph.trust_edges` persist independently. Two mechanisms for the sentence's two halves. |
| "Karmyq never touches the money" / "does not process payments, hold funds, or take a percentage" | **Negative, scope stated:** case-insensitive search for `stripe\|paypal\|payment_intent\|checkout_session` over `services/`, `apps/frontend/src`, `apps/landing/src`, `packages/` (excluding `node_modules`) at `e457e3b2` — **zero matches**. Positive corroboration: `pricing_notes TEXT, -- Advisory only — Karmyq never processes payment` (`022-provider-profiles.sql:12`). *Not checked: transitive dependencies, or any payment integration living outside the repo.* |
| "No ads · No tracking" | **Negative, scope stated:** case-insensitive search for `gtag\|google-analytics\|googletagmanager\|mixpanel\|segment\.\|posthog\|hotjar\|facebook\.net\|fbq(\|plausible\|matomo\|clarity\.ms\|sentry` over `apps/landing/src` and `apps/frontend/src`, plus a dependency-name scan of both manifests, at `e457e3b2` — **zero true matches** (hits were `segment.type` in content rendering and `segment` in JWT parsing). *Not checked: server-side logging, nginx access logs, or third-party scripts injected at deploy time.* |

### 2.2 Claims that fail

**F1 — The repository makes *contradictory* license claims, and has no license at all.**

This is worse than the original reading ("AGPL asserted but unrecorded"). There are two
incompatible public claims plus an empty legal state:

| Where | Claims |
|---|---|
| karmyq.org footer; `apps/landing/src/components/Footer.tsx:26`; `apps/landing/src/lib/landingContent.ts:278` | **AGPLv3** ("Fork it, improve it, make it yours … the AGPLv3 license keeps it that way") |
| `README.md:4` (badge, linking to a non-existent `LICENSE`), `README.md:164` | **MIT** |
| `docs/superpowers/plans/2026-06-01-multi-agent-pr-process.md:310` | Contributions are **MIT**-licensed |
| Root `package.json` | no `license` field |
| `git ls-files` (search: whole tracked tree, `-i` on `license|copying|agpl`) | **no LICENSE file** |
| GitHub API `gh repo view --json licenseInfo` (2026-08-06) | **`null`** — GitHub detects no license |

Repository visibility is **PUBLIC** (`gh repo view --json visibility`, 2026-08-06), so the
claims are live to anyone reading them.

**Therefore adding AGPL is a licensing *decision*, not a documentation fix.** With no license
file, default copyright applies and no grant has been made. Publishing AGPL is a **new legal
grant**, and doing so requires authority over prior contributions — which the MIT statements
above may have already promised differently. That question is *not* resolvable from a document
review; it needs ownership/contribution history. **This is the finding with legal weight and it
is not low-risk.**

**F2 — "You cannot arrive and immediately offer paid work. You have to earn standing first."**
False as the manifesto states it. `POST /requests/providers`
(`services/request-service/src/routes/providers.ts:352-359`) runs `authMiddleware`, validates only
that `service_type` and `display_name` are non-empty, then inserts. No trust floor, no karma
minimum, no completed-exchange requirement.

**But note where the conflict actually sits.** Open creation is ADR-041's *deliberate* design
(":53 — Self-registration: Any authenticated user can create a provider profile"). So this is not
code drifting from its own ADR — it is the **manifesto contradicting ADR-041**. ADR-041's answer to
"earn standing" is `provider_min_personal_trust_score`, a threshold on *appearing within a
community*, not on *creating a profile*.

That distinction sets S124's design: the standing requirement belongs at the community surface, and
gating global creation would be a change to ADR-041's semantics requiring its own decision — not a
bug fix.

**F3 — The ADR-041-designed community visibility policy shipped configured but unenforced.**

> ⚠️ **Corrected 2026-08-06 after review.** The first version of this finding claimed the
> platform-wide profile model made community gating *architecturally impossible* and that "the
> toggle was born inert in the same file that made it unenforceable." **That was wrong**, and it
> mattered: it turned a missing-enforcement bug into a fake architectural crisis, and it invented
> "gate reach, not existence" as a novel proposal when ADR-041 had already specified exactly that.

ADR-041 designs public profiles **and** community-gated visibility together, deliberately:

- `docs/adr/ADR-041-two-layer-mutual-aid-services.md:30` — "Publicly visible (not community-gated)
  — a rickshaw stand serves the neighborhood, not one community"
- **:53 — "Self-registration: Any authenticated user can create a provider profile. Communities
  can gate visibility with `provider_services_enabled` and `provider_min_personal_trust_score`."**

The migration supplied the whole policy in one block —
`infrastructure/postgres/migrations/022-provider-profiles.sql:54-58`: `provider_services_enabled`,
`provider_min_personal_trust_score`, **and** `provider_services_list`, under the comment
*"Community config: opt-in to showing provider services layer"*.

The plumbing for reach-gating largely exists already: `services/request-service/src/routes/providers.ts:64-82`
annotates each provider with `shared_communities` derived from **live** `communities.members`
(ADR-073, Sprint 93), explicitly not the JWT claim.

**The actual defect:** all three config columns are read/written only by
`services/community-service/src/routes/config.ts:58,209,240` and are consulted by **no** service,
package, or frontend code path (search: `grep -rn "provider_services_enabled"` across
`services/`, `packages/`, `apps/frontend/src` at `e457e3b2`). Worse, the toggle is **exposed to
community admins in the UI** — `apps/frontend/src/components/community/tabs/ProfileTab.tsx:342`
renders "Enable provider services / Allow members to discover neighborhood service providers in
this community" with a working switch. **Admins are operating a control that does nothing.**

Implementing reach gating is therefore **not architecturally blocked** — it is finishing an
existing design. A new ADR is warranted only if S124 changes ADR-041's *self-registration* or
*public-directory* semantics (see F2).

### 2.3 Built but never claimed (reverse audit)

- **`federation` schema is unimplemented.** `infrastructure/postgres/migrations/001_federation_schema.sql`
  creates instance-identity tables with public/private keypairs and a `federation_enabled`
  flag. **No service references `federation.` anywhere** (only `simulation-service`'s
  `tablePolicy.ts` names it, as policy metadata). CLAUDE.md counts it among "13 schemas";
  it is 12 live plus one reserved fossil.
- **A public, unauthenticated provider directory ranked by `trust_score DESC`**
  (`providers.ts:27,62`). Permitted by ADR-082's explicit `provider` disclosure class, so not a
  privacy violation — but it is the most marketplace-shaped surface in the system, and
  "It is not a marketplace" does not acknowledge it.
- **Collectives, dibs, activity scheduling and feedback** are all shipped and absent from the
  public story.

### 2.4 UNVERIFIED — claims not yet checked

These were surfaced by the audit but **not** traced to source. Do not cite them as either
holding or failing until read:

- "Every completed interaction generates karma for **both** people" — the both-sides half is unchecked.
- "When you join somewhere new, a portion of what you've built elsewhere doesn't disappear"
  (cross-community transfer). A `cross_community_prior` parameter exists; the transfer
  mechanism was not read.
- "To be nominated for a governance role, a member must first earn standing."
- "A role-holder whose presence has faded can be replaced."
- "The platform reads the existing patterns of interaction and suggests who belongs together"
  — split machinery is verified; the *suggestion* algorithm is not.
- "no platform override" on community rules.
- Whether the `reputation_disclosure` registry entry for the retired leaderboard is deliberate
  or stale metadata.

**Resolved out of this list:** repository visibility — confirmed **PUBLIC** via
`gh repo view --json visibility,licenseInfo` on 2026-08-06 (`licenseInfo: null`). Moved into F1's
evidence, where it establishes that the contradictory license claims are publicly readable.

**Runtime-UNVERIFIED (a separate class — deployment code is not a running process):**
- Whether the simulation service is *currently running* on the demo server. `scripts/deploy.sh:369-388`
  proves it is built and restarted on every deploy; it does **not** prove liveness now. Confirm with
  `pm2 list` / process inspection on the server before relying on it.
- Whether `reset:demo`'s real (non-dry-run) path restores a known baseline. D3 depends on this.
- "It's scaffolding. The whole point is to be outgrown" — not a falsifiable software claim;
  recorded as philosophy, not audited.

---

## 3. Maintainer decisions recorded

| # | Decision | Made |
|---|---|---|
| D1 | The manifesto is the spine; audit first, then everything else | 2026-08-06 |
| D2 | Close the provider gap **in code** — enforce the story rather than rewriting it | 2026-08-06 |
| D3 | The simulation may act as **all** users, including the protected personas | 2026-08-06 |
| D4 | Demo data: **backfill aged history, then let the live sim carry it forward** | 2026-08-06 |
| D5 | Ship all four workstreams, truth before data | 2026-08-06 |
| D6 | **Four sprints, one topic each** — not one multi-PR sprint | 2026-08-06 |
| D7 | **The project is AGPL.** "I am happy to move forward with making everything AGPL" | 2026-08-07 |

**On D3 — cost accepted knowingly.** Letting the sim act as the 9 `protected` personas
removes ADR-087's always-true deterministic baseline. The mitigation designed in is
**restorable rather than frozen** reproducibility: `reset:demo` restores the baseline on
demand, and smoke tests reset before running instead of relying on 9 immutable accounts.
This requires `reset:demo`'s real (non-dry-run) path to be verified, which it currently is not.

**On D6 — the diagnosis behind it.** The process break is not "multiple PRs"; it is *multiple
unrelated topics sharing one review context*. Two PRs on one topic compound context and get
cheaper. Four PRs on four topics means four cold starts and a handoff carrying four
independent states. Sprint 122 is the evidence: six PRs, a wrong root cause in PR 3, the same
failure class repeated in PR 4, five defects across two review rounds in PR 5, a handoff nearly
lost to a merge, and an epilogue still unmerged. ADR-091 exists because of that cost.

---

## 4. The arc

### S123 — Licensing decision + record the truth

> ⚠️ **Reframed after review. This is NOT "near-zero risk" and is not a documentation task.**
> The original version treated AGPL as recording an existing truth. F1 shows the repo actively
> claims **MIT** in its README while the manifesto claims **AGPL**, with no license file at all.
> Choosing one is a legal act, not a cleanup.

**Why first:** the audit exists only in a chat transcript. Left unwritten, the fact that three
community-config columns and an admin-facing UI toggle control nothing is lost, and someone
re-derives it in three months.

**Step 1 — decide, before writing any file.**
- **MIT or AGPL? → ✅ DECIDED: AGPL (D7, 2026-08-07).** They are not interchangeable: AGPL's
  network-copyleft is what makes the manifesto's "if someone runs Karmyq, their changes stay open
  too" true. MIT does not do that, and the manifesto's whole commons argument depends on the
  answer. The landing footer and `landingContent.ts` were already claiming AGPLv3; this decision
  makes the README's MIT claim the one that is wrong, and it must be corrected rather than the
  reverse.

  ⚠️ **Deciding the license does not discharge the provenance work below.** The two actions in the
  next bullet remain **blocking prerequisites** to publishing a `LICENSE` file. The maintainer's own
  stated uncertainty is here, not in the choice of license.
- **Provenance — measured 2026-08-06, no longer speculative.**

  **No distribution has occurred.** `gh repo view`: `forkCount: 0`, `stargazerCount: 0`,
  `watchers: 0`; `gh api repos/.../forks` → `0`. Nobody has received the code under the README's
  MIT claim, so no third party has relied on it. **This was the larger risk and it is clear.**

  **But the maintainer is not the sole copyright holder.** `git log --all` over 1,681 commits:

  | Identity | Commits | Surviving lines in the live tree |
  |---|---|---|
  | Ravi Chavali (2 emails) | 1,575 | the bulk |
  | **Pallavi Ravi** / `kompellachavali` <kompella.chavali@gmail.com> | **26** | **119/328 of `infrastructure/nginx/nginx.conf` (36%)**, 20/464 of `docker-compose.yml`. Auth-service edits fully rewritten (0 surviving). Last commit 2025-12-31 |
  | **`Karmyq Developer` <karmyq@example.com>** | **12**, incl. **the initial commit** (`1dea32d1`) | 45/239 `community-service/src/index.ts`, 35/105 `auth-service/src/index.ts`, 103/464 `docker-compose.yml`. Last commit 2025-11-04 |
  | `dependabot[bot]` | 68 | mechanical manifest/lockfile edits — not authorship |

  Confirmed by GitHub's own contributor list: `ravichavali`, `kompellachavali`, `dependabot[bot]`.

  **Two actions before publishing any license:**
  1. **Obtain and record Pallavi Ravi's agreement** to the chosen license. Their infrastructure
     work materially survives; 36% of a load-bearing production config is not de minimis. A
     written "yes" (email/message) referenced in ADR-092 is sufficient for a project this size.
  2. **Confirm `Karmyq Developer <karmyq@example.com>` is the maintainer's own pre-config
     identity.** Dates (2025-11-03/04) and the repo creation date (2025-11-04) make this very
     likely, but it authored the initial commit and ~180 surviving lines, so it should be
     stated, not assumed. If confirmed, record it; consider a `.mailmap` entry.

  MIT→AGPL relicensing of one's *own* work is unproblematic. The above is the entire delta
  between that and the actual situation.

**Step 2 — implement the decision.**
- `LICENSE` at repo root with the chosen license's full text.
- `"license": "<SPDX-id>"` in root `package.json`.
- Reconcile **every** active claim: `README.md:4` (badge — currently links to a file that does not
  exist), `README.md:164`, `Footer.tsx:26`, `landingContent.ts:278`, karmyq.org, and the
  contributor plan.
- **ADR-092** — this audit: claims that hold with references, F1–F3, reverse findings, UNVERIFIED
  list, and the licensing decision with its reasoning.
- **ADR-093** — `federation` recorded as reserved, unimplemented scaffolding. *Do not delete the
  schema*: `init.sql` is generated from migrations and the demo database already carries it, so
  deletion is a migration with real risk and no user benefit.
- CLAUDE.md: "13 schemas" → 12 live + 1 reserved.

**Gate — must detect *disagreement*, not merely absence.** A test asserting only "LICENSE exists"
would have passed happily through the entire MIT-vs-AGPL contradiction. It must cross-check
`LICENSE` ↔ `package.json` ↔ README badge ↔ README license section ↔ landing footer and fail if any
two disagree. Per ADR-091, prove it by flipping one source to the wrong license and watching it go
**red**.

### S124 — Exemption mechanism and honest Expo drift gate *(complete, v11.44.0)*

Sprint 124 shipped PR #204 (`a1cf9eca`). It generalized the time-boxed exemption-registry core,
renewed the two still-unpatched `image-size` advisories through the first invalid day
`2026-08-18`, and made BUG-035's Expo drift gate green honestly through SDK-generation-scoped
divergences. This was urgent security/process work, not a manifesto product workstream, and it
shifted the remaining arc by one sprint.

### S125 — The provider question *(security Task 0 + one ADR + implementation)*

#### Task 0 — `image-size` remediation and weekly upstream check

This is an urgent security prelude, not provider-domain scope. The dependency remains
`apps/mobile → expo → @expo/metro → metro@0.84.4 → image-size@1.2.1`. Re-measured 2026-08-13:
`image-size` latest is still `2.0.2`, both advisories affect `<=2.0.2` with no patched release,
and Metro latest `0.87.0` still declares `image-size: ^1.0.2`.

- **First action in the sprint:** remeasure npm, both GitHub advisories, Metro's dependency, and
  the live lockfile before the current exemption becomes invalid on `2026-08-18`.
- Add a **weekly**, schedule-only GitHub workflow plus `workflow_dispatch`. It queries the live
  upstream versions/advisories and the repo's current exemption horizon. It stays quiet while
  nothing actionable changes and files or updates one issue when a patched package/compatible
  Metro path appears or renewal/remediation needs attention.
- Automation must **never edit or renew** `security/audit-exemptions.json`. A renewal is a fresh
  reviewed decision with current measurements and may buy at most seven more days.
- If upstream is still blocked, pursue the real fix: a narrowly tested, immutable 1.x-compatible
  backport/fork preserving Metro's CommonJS/default-export contract, or a tested Metro patch that
  removes the dependency. Renaming vulnerable code is not remediation; malicious ICNS, JXL, and
  HEIF fixtures must prove the parser cannot hang before both exemptions are deleted.
- Done means the vulnerable package is absent or patched, `npm audit --package-lock-only` is clean,
  Metro/mobile bundle behavior is proven, and both exemption entries are removed. A fresh renewal
  is only a time-boxed bridge, not completion of Task 0.

> ⚠️ **Reframed after review.** The original version put the standing threshold on **global
> provider-profile creation** — a surface where *no community is selected*, so a
> community-configurable threshold is not even well-defined there. It also proposed
> "gate reach, not existence" as a new option when ADR-041:53 already specifies it.

**The primary work is enforcement, not architecture.** ADR-041 already designed the policy and the
migration already shipped the three config columns; nothing consults them. S125 makes the existing
design real:

- Enforce `provider_services_enabled` — providers surface in a community only if it opted in.
- Enforce `provider_min_personal_trust_score` — **at the point of selecting providers for a
  community surface**, not at global profile creation. This is where "you have to earn standing
  first" becomes true, and it is where the existing column was always meant to apply.
- Enforce `provider_services_list` — the third shipped-but-unread column; decide whether it is in
  scope or explicitly deferred.
- `providers.ts:64-82` already derives live `shared_communities`; reuse that, do not re-derive.

**An ADR is needed only for the semantic questions**, which are genuinely open:

1. **Does standing gate global registration too, or only community reach?** Gating registration
   changes ADR-041's self-registration decision and needs its own justification (F2).
2. **What happens to the unauthenticated global directory** (`providers.ts:27`, ranked
   `trust_score DESC`)? It is the most marketplace-shaped surface in the system and sits outside
   any community, so community gating cannot reach it. Options: leave public, require auth,
   restrict to shared communities, or retire it. **Undecided — this is the real product question
   in S125.**

Gates must be proven to **reject**, not merely to pass.

### S126 — Demo data backfill

> 🔴 **Corrected after review — the original version was wrong about the tooling, in the exact
> direction that would have caused silent damage.** It said `TimeTravelFactory` "already exists for
> exactly this." **It does not satisfy the replay constraint; it violates it.**

**`TimeTravelFactory` must be substantially refactored or replaced before it can be used here.**
Its header promises *"Create record via API (triggers business logic) → update timestamps in
database"* (`tests/fixtures/timeTravelFactory.ts:10-12`), but its implementation does the opposite
for derived data:

- `createBackdatedKarma()` — `INSERT INTO reputation.karma_records (…)` **directly**, with the
  caller supplying `points` (`timeTravelFactory.ts:72-79`).
- The scenario helper inserts into `messaging.messages` directly (`:211-214`) and awards
  **hardcoded** karma — `points: 10, reason: 'Completed help request'` (`:222`).

Using it as-is would fabricate a demo whose karma totals never passed through `karmaService`, so
the numbers would be *asserted* rather than *earned* — precisely the class of falsehood this whole
arc exists to remove. **S126's first task is fixing the factory**, not seeding with it.

**Non-negotiable constraint:** every backfilled score is produced by **replaying production
math** — issue the real command/event, let the service compute, then backdate only *source*
timestamps. Sprint 117 set this precedent ("fixture-only replay locked to production math");
S126 extends it. `ConsolidatedSeeder` provides `quick`/`staging`/`production` profiles
(20 / 2000 / 2000 users) and is unaffected by this finding.

Target shape, chosen so the claims that hold become *visible* to a visitor:
- karma records spanning >12 months, so the six-month half-life visibly bites;
- completed exchanges older than the retention window, so `[forgotten]` anonymization is observable;
- repeat interactions between the same pairs, so `depth_weight` has demonstrably moved;
- conversations with messages on the flagship personas — which also finally proves
  `redisClient.publish`, outstanding since PR 5.

**Prerequisite, not a deliverable:** cross-community trust transfer is listed **UNVERIFIED** in
§2.4 — the `cross_community_prior` parameter exists but its transfer mechanism has never been
read. The original target shape promised data making it "show something", which would have been
building a demo around a behaviour nobody has confirmed exists. **Verify the mechanism first; only
then decide whether it belongs in the target shape.** It is deliberately excluded above.

**Verification:** extend `verify:demo` to assert the target shape, so "the data is good" becomes
a command that can fail rather than an impression.

### S127 — Live simulation across all users

- Remove the protected-core exclusion from the actor pool
  (`buildActorPoolPredicate()`, `services/simulation-service/src/db-user-loader.ts:57-67`),
  per D3.
- Verify `reset:demo`'s real path restores a known baseline; make smoke tests reset-then-run.
- Tune worker count and cadence for sustained density.

**Accepted gap:** between S126 and S127 the flagship personas stay static. The demo is not
frozen — the sim already runs continuously against the 27 `ambient` users — so the cost is
narrow.

---

## 5. Current seeding surfaces (reference)

| Surface | Role |
|---|---|
| `services/simulation-service/` | Intended live 24/7 behaviour. `scripts/deploy.sh:369-388` builds and restarts it every deploy; `config/default.json` sets 16 workers, `schedule.type: continuous`; 21 workflows exist. **Whether it is running right now is runtime-UNVERIFIED** — deployment code proves the mechanism, not the process. |
| `db-user-loader.ts` | Actor selection. `SIM_ACTOR_POOL_FILTER` limits actors to `@test.karmyq.com`; `buildActorPoolPredicate()` excludes all `protected` fixture emails. |
| `fixtures/curatedDemo/manifest.ts` | 36 named people: **9 `protected`**, 27 `ambient`. |
| `tests/fixtures/consolidatedSeeder.ts` | Bulk seeding, three profiles. |
| `tests/fixtures/timeTravelFactory.ts` | Backdating for decay/TTL/trust-evolution. |
| `infrastructure/postgres/seed-data.sql` | Curated demo data, spliced into generated `init.sql` (ADR-087). |

**Root cause of the thin demo, traced:** the nine richest personas — `maria.reyes`,
`elena.torres`, `noah.williams`, `sophia.chen`, `james.okafor`, `priya.sharma`, `wei.zhang`,
`fatima.alhassan`, `amina.baptiste` — are precisely the nine the simulation is forbidden to act
as. This is ADR-087's determinism guarantee working as designed, not a bug. It is why
`maria.reyes@` has zero conversations and why `redisClient.publish` has never been proven.

---

## 6. Open questions for the next chat

1. **S125's ADR fork** — the two semantic questions in §4 S125: (a) does standing gate *global
   registration* as well as community reach, or only reach? (b) what happens to the unauthenticated
   global directory — leave public, require auth, restrict to shared communities, or retire it?
   Neither is decided. *(This item previously read "options 1/2/3 above", a dangling reference to a
   list that no longer exists after the S124 reframe.)*
2. **How is "standing" defined?** Completed-and-rated exchanges in the community, a trust-score
   floor, or time-plus-activity. Needs a decision that a community can configure.
3. **Backfill honesty.** Backfilled history is synthetic even when replayed through real math.
   Whether that is acceptable for an investor-facing demo is a maintainer call, and it was
   deliberately not resolved in this chat.
4. Whether the UNVERIFIED items in §2.4 belong in S123's ADR-092 as follow-up or get checked first.

---

## 7. Prerequisite — ✅ SATISFIED (2026-08-07)

**Sprint 122 is closed and shipped.** This section previously said #195 was open and that S123
must not branch from `origin/master`; both are now false, and the sequence it prescribed has been
executed.

| | |
|---|---|
| PR #195 | **MERGED** 2026-08-07T02:47:11Z, squash `e5dc24ce` |
| `origin/master` | `e5dc24ce`, **v11.42.0** |
| Deploy | CI/CD Pipeline **14/14 green including `Deploy to Demo`**, no rollback |
| Smoke test (real paths, `node` + `fetch`) | landing **200** · bodyless `POST /api/auth/login` **400 `VALIDATION_ERROR`** · wrong password **401 `UNAUTHORIZED`** |
| Sprint 122 handoff | archived to `.claude/handoff/archive/2026-08-06-sprint-122-…-SHIPPED-v11.42.0.md` |
| ADR-091 | flipped `Accepted` → `Implemented` |
| Branch base | **`docs/sprint-123-planning`, cut from `origin/master` `e5dc24ce`** — the correct base, available now |

The ADR-060 gate was additionally observed working on the **push** path during the deploy, which
its test suite cannot model: it logged `Waiting for analyses` across three attempts, watched
`actions` land, kept waiting for `javascript-typescript`, and only then evaluated. Under the
pre-fix code it would have passed at attempt 3 with the JS analysis still pending.

**Note on the earlier `/code-review`:** it ran against `13e273b6` and its eight findings were fixed.
Three later commits (`74a8e87b` sha-filter fix, `e457e3b2` handoff, `15858ac1` closeout) were
reviewed by the author only. That is a known gap, not a blocker — recorded here rather than
implied to be complete.
