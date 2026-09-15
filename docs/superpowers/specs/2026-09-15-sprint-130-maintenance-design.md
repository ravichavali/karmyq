# Sprint 130: Stop Asking for Reputation We Can't Be Given — Design Spec

**Date**: 2026-09-15
**Status**: Approved (maintainer decisions recorded 2026-09-15)
**Version**: v11.53.0 → v11.54.0 (PR A) → v11.55.0 (PR B). Each bump is taken from `origin/master` at merge time.
**Sprint Branches**: PR A `feature/sprint-130-maintenance` (exists; holds the Sprint 129 close-out
commit `71b4efe8`) · PR B `feature/sprint-130-security` (branched from `origin/master` after PR A merges)

---

## Overview

Sprint 129 made a denied community-trust aggregate an empty state instead of a 404, which removed
the console errors on `/communities`. It also showed that three frontend surfaces ask for reputation
that ADR-082 will never give them, on every page load:

- **BUG-044:** `/communities` requests community trust for every discovery card (37 on the demo),
  but the grid excludes joined communities and the aggregate goes only to members. Every request is
  a guaranteed denial, and the "★ N% trust" badge can never render.
- **BUG-042:** the community People tab requests `GET /reputation/trust/:userId/:communityId` for
  every member. That route is self-only, so N−1 requests return 404, and the pill shows "—" for
  everyone except the caller.
- **BUG-043:** `/communities` loads the community list, plus its whole per-card fan-out, twice when
  the saved discovery mode is "interests".

The same sprint clears the carried security and dependency backlog. Code-scanning alerts #540–#542
(`js/log-injection`, geocoding-service) are **real**. #578 (`js/file-access-to-http`) is the monitor
script working as designed. Dependabot #239 carries two dev patch bumps.

### Core Principle: Ask Only for What the Caller Can Be Shown

A client must not issue a request whose authorization outcome the page already knows is a denial.
Where a number can legitimately exist (the caller's own communities), show it there. Where it can't
(another member's score, a community the caller hasn't joined), remove the surface rather than
render a placeholder.

---

## Maintainer decisions (2026-09-15, do not re-litigate)

| Question | Decision |
|---|---|
| Scope | Fan-out + security: BUG-042, BUG-043 and BUG-044 (PR A); #540–#542, #578 and #239 (PR B). BUG-033, BUG-034, BUG-036 and the seven majors #224–#230 stay out. |
| BUG-044 | **Move the badge to the "Your Communities" chips.** Fetch community trust only for joined communities and never for discovery cards. |
| BUG-042 | **Remove the per-member score pill** from the People tab. No per-member reputation reads. |
| Dependency lane | **Claude holds it** for PR B (#239). No other dependency work runs until PR B merges. |

---

## Data Model

No schema changes. No migration.

## API Endpoints

No endpoint added, removed or changed. The call pattern changes, the server contract does not:

| Endpoint | Before | After |
|---|---|---|
| `GET /reputation/community-trust/:communityId` from `/communities` | once per discovery card (all denied) | once per **joined** community (chips) |
| `GET /reputation/trust/:userId/:communityId` from the People tab | once per active member (N−1 × 404) | **never** |
| `GET /communities` on `/communities` load | twice when the saved mode is "interests" | once |

`LeftSidebar.tsx:42` keeps its **self** `getTrustScore(user.id, …)` read. It's the caller's own
score and ADR-082 permits it. Only the per-member fan-out goes.

## Frontend Changes (PR A)

1. **`pages/communities/index.tsx`, BUG-044**
   - Remove the `fetchTrustScores(newCommunities…)` call from `fetchCommunities` (`:199`), and the
     discovery-card badge (`:728-732`).
   - Fetch trust for `user.communities` ids once `user` is known, and render `★ N% trust` on the
     matching "Your Communities" chip (`:436-446`) when the score is non-null.
   - A null score (for example a joined community under 5 members) renders no badge and logs nothing.
2. **`pages/communities/index.tsx`, BUG-043.** Don't start the first list fetch until the persisted
   mode has been read.
   - Today the mode effect (`:266-301`) fires for the initial `'geography'` state (`:90`) and again
     after the mount effect applies `readDiscoveryMode()`.
   - **Do not** fix this with `useState(readDiscoveryMode)`. The page has no
     `getServerSideProps`/`getStaticProps`, so Next.js prerenders it with `'geography'`, and a
     client-side lazy initialiser that returns `'interests'` causes a hydration mismatch. React logs
     that as a console error, which reintroduces exactly the noise Sprint 129 removed.
   - Gate instead: a `modeResolved` flag set by the mount effect, which the mode effect checks before
     it fetches.
3. **People tab, BUG-042**
   - `hooks/useCommunityData.ts`: delete `memberTrustScores` state, `fetchMemberTrustScores` (`:188-200`)
     and the two return keys.
   - `pages/communities/[id].tsx`: delete the `refetchMemberTrustScores()` call (`:80`) and the prop (`:264`).
   - `components/community/tabs/ActiveTab.tsx`: delete the `memberTrustScores` prop and the pill IIFE (`:202-213`).

## Backend Changes (PR B)

1. **`services/geocoding-service/src/geocodingService.js`, #540–#542**
   - `validateSearchQuery` allows `\s` in the middle of a query (`SAFE_ADDRESS_QUERY_PATTERN`,
     `:2`), and `trim()` strips only the ends. A query with an embedded `\n` therefore reaches the
     three `logger.log` lines (`:111`, `:118`, `:129`) raw. Those lines also log `query`, not the
     validated value.
   - Fix at the source: collapse every whitespace run to a single space during normalisation, and
     log only `normalized`.
   - This also improves the cache key: `"a\nb"` and `"a b"` become one entry.
   - If the CodeQL rescan doesn't recognise the sanitiser, add an explicit `.replace(/[\r\n]/g, '')`
     at the log sites. Never dismiss these alerts; they're real.
2. **#578 `scripts/check-image-size-upstream.js`: dismiss with justification.** The "file data" is
   the package name read from the repo's own `security/audit-exemptions.json`, sent URL-encoded to
   `api.github.com`'s advisory API. That is the script's whole purpose, and the file is
   maintainer-controlled. One dismissal API call (reason `won't fix` or `false positive`, ≤280
   chars), never a loop. Record it in PR B's *Security dismissals*.
3. **Dependabot #239.** `eslint-config-next` 16.3.4 → 16.3.5 and `yaml` 2.9.0 → 2.9.1 (dev),
   across `apps/frontend`, `apps/landing`, `tests` and the lockfile. Apply surgically on PR B's
   branch, and close #239 with a link.

---

## User Guide & Doc Updates

| Doc | Update | PR |
|---|---|---|
| `docs/guides/community-admin-guide.md` + `docs/guides/admin-community-guide.md` "Community Trust Score" | Members see the badge on their **Your Communities** chips on the discovery page, not on discovery cards. Correct the Sprint 129 wording. | A |
| `docs/guides/admin-community-guide.md:56` | "see their karma and trust scores" is false under ADR-082. Admins see members and roles, not other members' scores. | A |
| `apps/frontend/src/lib/onboarding/workflows.ts` | Grep for any step describing per-member scores or discovery-card badges, and correct it. | A |
| `docs/adr/ADR-082-*.md` | Short Sprint 130 note under the Sprint 129 amendment: client fan-outs that could only be denied were removed (BUG-042, BUG-044). The Sprint 113 section's per-member 404 note is now historical. | A |
| `services/reputation-service/CONTEXT.md` | Correct the Sprint 129 entry's "badge now renders" line, and note the call-pattern change. | A |
| `docs/BUGS.md` | BUG-042, BUG-043, BUG-044 → fixed; correct BUG-031's badge sentence cross-reference. | A |
| `docs/IDEAS.md` | The batching idea is largely obsolete (only joined communities are fetched now). Annotate rather than delete. | A |
| `services/geocoding-service/CONTEXT.md` | Recent fix: log injection via embedded whitespace; whitespace normalisation of the cache key. | B |
| Landing docs | Regenerate from sources, keep content changes, revert timestamp churn. | A, B |

---

## Critical Implementation Notes

1. **Never fix BUG-043 with a lazy `useState` initialiser that reads localStorage.** The page is
   prerendered, so a client/server mismatch logs a hydration error to the console. Gate the first
   fetch on a resolved flag instead. Prove it with a test that asserts `getCommunities` is called
   **exactly once**, with the persisted mode, for both `'interests'` and `'geography'`.
2. **A test must reach a state the real page can reach.** Sprint 129's badge test mocked a score for a
   card the real grid filters out, and passed while the feature was dead (BUG-044). Every PR A
   render test builds its fixture from the page's real filters: joined ids come from
   `user.communities`, and the grid is `communities` minus joined.
3. **Assert the absence of requests, not only of UI.** BUG-042/044 are about requests. Tests must
   assert `getTrustScore` is **not called** on People tab open, and that `getCommunityTrust` is called
   with **exactly** the joined ids, never a discovery-card id.
4. **Keep `LeftSidebar`'s self read.** Only the per-member fan-out in `useCommunityData` goes.
   Grep `getTrustScore(` before and after; exactly one call site should remain.
5. **The server contract doesn't change.** Don't touch `reputation.ts`, `health.ts` or any 404/200
   status. BUG-042's fix is removing the caller, never changing the self-only 404.
6. **Don't edit `apps/frontend/src/lib/api.ts`.** A line shift re-raises the CodeQL
   `js/request-forgery` false positive as new alert ids and blocks the master deploy.
7. **#540–#542 are real, so fix them, never dismiss.** `\s` in `SAFE_ADDRESS_QUERY_PATTERN` admits
   `\n`/`\r` mid-query. The regression test must feed a query containing `\n` and assert that no
   logged string contains `\n` or `\r`, and that the cache key is whitespace-collapsed.
8. **#578 is one dismissal, with its justification recorded in the PR body.** Never loop the
   dismissal API.
9. **Geocoding tests are `.js`, and the promoter only moves `*.test.ts`** (`promote-tdd-tests.js:33`,
   the same blind spot as BUG-033). The geocoding `test` script runs only `tests/unit` and
   `tests/regression`. Write the test in `tests/tdd/` first, prove red with a direct `npx jest`, then
   **move it to `tests/regression/` by hand** in the same PR. A test left in `tdd/` there runs nowhere.
10. **The dependency edit is surgical** (CLAUDE.md, *Workspace dependencies*). Splice the #239 entries
    in place. Prove with `npx -y npm@11.19.0 ci` **and** `npm ls --all | grep invalid` (baseline is 3
    pre-existing invalids: color-string, ms, picomatch). Never `npm install --workspace`, dedupe or
    scratch-regen on this Windows box.
11. **`eslint-config-next` is already 16.x against `next` 15** (the mismatch recorded on #229). #239
    is a patch within 16, and it must not become a `next` bump.
12. **The TDD promoter sweeps unrelated files.** After any full `npm test`, restore promotions that
    don't belong to the PR.
13. **`apps/landing/src/data/docs/` is only partly tracked, and its directory is gitignored.** Stage
    tracked regenerations with `git add -u`, keep content changes, and revert `architecture.json` and
    `build.json` timestamp churn.
14. **One merge at a time, and PR B branches after PR A merges.** Every master push is a full deploy.
    Take the version bump from `origin/master` at merge time.
15. **Verify live after each deploy, in a browser, as `maria.reyes`:**
    - `/communities`: 0 console errors, **no** community-trust request for a discovery-card id,
      exactly one `GET /communities` for the saved mode, and a badge on any joined chip whose score
      is non-null.
    - Community People tab: 0 `/reputation/trust/` requests.

## Done looks like

- `/communities` as `maria.reyes`: 0 console errors, community-trust requests equal to her joined
  communities (6, not 37), one list fetch, and badges on her scored chips (live scores were 1 and 2).
- People tab: 0 reputation requests, and no per-member score pill.
- Code-scanning alerts #540–#542 **closed by the fix** (verified on the rescan), #578 dismissed with
  justification: **0 open code-scanning alerts**.
- #239 merged via PR B; **0 open Dependabot security alerts** maintained.
- BUG-042, BUG-043, BUG-044 fixed; every doc that overstated the badge corrected.
