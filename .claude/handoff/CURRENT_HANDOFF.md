# Sprint 125 — Provider Standing, with `image-size` Security Task 0 (PLANNING)

> ## State as of 2026-08-13
>
> Sprint 124 shipped as PR #204, squash `a1cf9eca`, version **v11.44.0**. The maintainer reports
> the demo deploy healthy, login/error/landing smoke tests passing, Expo drift green against its
> live arbiter, and issue #196 closed. `master` and `origin/master` both resolve to `a1cf9eca`.
>
> This branch is `feature/sprint-125-provider-standing`, cut from that synced master. It exists so
> the Sprint 124 handoff can be reconciled without a docs-only push to master.
>
> **Sprint 125 is not fully planned yet.** Its product work is the provider-standing question
> displaced by Sprint 124. The maintainer has approved one added scope item: an urgent security
> Task 0 for `image-size`, including a **weekly** upstream check.
>
> ⏰ The two `image-size` exemptions use `expires` as the first invalid day. They are live through
> **2026-08-17** and fail starting **2026-08-18**. Task 0 must begin with an immediate remeasurement;
> the first weekly scheduled run is not a substitute for meeting this deadline.

---

## Sprint goal

Make provider standing and community opt-in real without allowing the unresolved `image-size`
dependency to freeze development or become permanent hidden risk.

## Quick Start

1. Read this handoff and the arc section in
   `docs/superpowers/specs/2026-08-06-sprint-123-126-manifesto-alignment-arc-design.md`.
2. Stay on `feature/sprint-125-provider-standing` and confirm a clean tree.
3. Before writing the full Sprint 125 spec/plan, decide the provider questions below.
4. Start Task 0 by re-running the live upstream measurements before 2026-08-18.
5. Use `.claude/skills/sprint-planning/SKILL.md` to produce the Sprint 125 spec and plan after the
   product decisions are confirmed.

---

## Approved Task 0 — `image-size` remediation and weekly upstream check

### Current evidence

- Reach: `apps/mobile → expo@57.0.12 → @expo/metro@56.0.0 → metro@0.84.4 → image-size@1.2.1`.
- `npm view image-size version` returned `2.0.2` on 2026-08-13.
- Both advisories affect `<=2.0.2` and list no patched release:
  `GHSA-w3rx-r6r6-pgpr` and `GHSA-5p2g-fcmc-qvqq`.
- `npm view metro version` returned `0.87.0`; its live dependency remains `image-size: ^1.0.2`.
- Forcing `image-size@2.0.2` is not a fix: it remains affected and drops the default export Metro's
  asset code expects.

### Required behavior

1. **Immediate deadline check:** remeasure npm, both advisories, Metro, the resolved tree, and the
   live audit before the current exemption becomes invalid.
2. **Weekly monitor:** add a schedule-only GitHub workflow with `workflow_dispatch`. It checks the
   upstream package/advisory state and the local exemption horizon once per week.
3. **Signal policy:** unchanged upstream state is quiet. File/update one issue when a patched
   package or compatible Metro path appears, or when the exemption needs an explicit decision.
4. **No automatic renewal:** the workflow must never edit `security/audit-exemptions.json`.
   Renewal requires fresh measurements, a reviewed rationale, and no more than seven days.
5. **True remediation:** if upstream remains blocked, use an immutable, narrowly tested
   1.x-compatible backport/fork or a tested Metro patch that removes `image-size`. A renamed copy of
   vulnerable code is not a fix.
6. **Removal proof:** malicious ICNS, JXL, and HEIF fixtures cannot hang; Metro/mobile bundling
   remains functional; strict `npm ci`, mobile tests/type-check, `npm ls image-size`, and live
   `npm audit --package-lock-only` support deleting both exemption entries.

Task 0 is complete only when the vulnerable implementation is removed or patched and the two
exemptions are deleted. A renewal is only a bridge.

---

## Provider decisions still required before the Sprint 125 spec

1. Does standing gate global provider registration, or only reach into a community? ADR-041
   currently supports gating reach; changing registration needs an explicit new decision.
2. What happens to the unauthenticated global provider directory: leave public, require auth,
   restrict to shared communities, or retire it?
3. Confirm whether `provider_services_list` enforcement ships with the other two existing but
   unread columns or is explicitly deferred.

Existing implementation anchor: `providers.ts:64-82` already derives live `shared_communities`;
reuse it rather than deriving membership a second way.

---

## Carried item

**BUG-036 remains open:** `.github/workflows/test.yml` uses a fixed `sleep 30` before the Docker
health probe, which races cold image pulls. Keep it separately scoped unless the Sprint 125 plan
explicitly adopts it.

---

## Arc after Sprint 124's displacement

- Sprint 123 — licensing and truth audit: complete, v11.43.0.
- Sprint 124 — exemption mechanism and honest Expo drift gate: complete, v11.44.0.
- Sprint 125 — `image-size` Task 0 + provider standing/community reach.
- Sprint 126 — honest demo-data backfill through production math.
- Sprint 127 — live simulation across all users.

---

## Standing mechanics

- Branch from `origin/master`; never direct-push to master and never force-push.
- Every merge needs explicit maintainer authorization.
- Do not use a docs-only master push to reconcile this handoff; land it with Sprint 125 work.
- Dependency edits are surgical: no workspace install, dedupe, or lockfile scratch regeneration.
- Assert resolved versions after every dependency operation; npm's “up to date” text is not proof.
- `curl` and `jq` are unreliable/unavailable on this Windows machine; use Node for probes/JSON.
- All four SDLC gates remain mandatory before merge: testing, simplify, code review, security review.
