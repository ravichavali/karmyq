# Sprint 87 — Demo Data Prep Log

**Date:** 2026-06-05
**Operator:** Claude (executing Sprint 87 plan, Task 4)
**Target:** demo DB `karmyq_prod` on `ubuntu@karmyq.com` (container `karmyq-postgres`, postgres:15-alpine)
**Maintainer approval:** Op 1 + Op 2 approved (no reseed) — recorded 2026-06-05.

> This was a **destructive data op with a rollback boundary**. Backup taken first, dry-run inventory
> reviewed, deletion set approved by the maintainer, deletes run inside a single guarded transaction
> with row-count assertions (auto-rollback on surprise).

---

## 0. Deploy-drift check (pre-flight)

Latest "Deploy to Demo" / CI-CD Pipeline GitHub Actions runs on `master` were **green** (commit
`42b9fb1` roadmap). The 2 newer local-master commits are S87 spec/plan docs only (no production code),
so demo content matched master's production state. All 11 services + postgres + redis reported healthy
(`docker ps` → all `Up`, postgres/redis `healthy`).

## 1. Backup (rollback path)

```bash
ssh ubuntu@karmyq.com
TS=$(date +%Y%m%d-%H%M%S)
mkdir -p ~/karmyq-backups
docker exec karmyq-postgres sh -c 'PGPASSWORD=$POSTGRES_PASSWORD pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  | gzip > ~/karmyq-backups/karmyq_prod_pre-s87-reseed_${TS}.sql.gz
```

**Backup file:** `/home/ubuntu/karmyq-backups/karmyq_prod_pre-s87-reseed_20260605-200249.sql.gz` (11 MB)

**RESTORE / ROLLBACK command** (if the cleanup needs to be undone):

```bash
# Drops and recreates schema content from the dump. Run on the demo server.
gunzip -c ~/karmyq-backups/karmyq_prod_pre-s87-reseed_20260605-200249.sql.gz \
  | docker exec -i karmyq-postgres sh -c 'PGPASSWORD=$POSTGRES_PASSWORD psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```
(The dump is a plain-SQL `pg_dump`; restore into the existing DB. For a clean restore, drop+recreate
the affected schemas first, or restore into a scratch DB and diff.)

## 2. Dry-run inventory (read-only — no deletes)

State **before** cleanup:

| Table | Rows |
|---|---|
| auth.users | 505 (all match `sim|test|seed|demo|example|fake` → fully synthetic) |
| communities.communities | 60 |
| communities.members | 6,851 |
| requests.help_requests | 1,438 (open 1,132 / completed 299 / matched 7) |
| requests.matches | 27,473 (proposed 16,389 / rejected 10,777 / completed 300 / matched 7) |

**Noise identified:**
- **Match-spam:** single requests held 876 / 772 / 751 proposed matches (sim over-generation).
- **Dunbar-cap violation:** 10 communities over the platform's stated 150-member cap
  (284, 263, 263, 241, 236, 227, 214, 204, 192, 161) — 785 member-rows above cap.
- Orphaned matches: 0.

**FK safety pre-check** (dependents of the to-delete match set):
`feedback`=0 (NO ACTION, would block), `conflict_cases`=0 (NO ACTION, would block),
`conversations`=1 (CASCADE), `interaction_feedback`=0, `featured_stories`=0, `provider_reviews`=0.
→ No blocking dependents; only 1 cascade conversation (a spam artifact). `communities.members` has
0 referencing FKs → member trim is FK-safe.

## 3. Approved deletion set

- **Op 1 — De-spam matches:** keep all terminal (completed/matched); keep the 5 most-recent
  proposed/rejected per request; delete the rest. Projected delete ≈ 23,617.
- **Op 2 — Enforce 150 cap:** on the 10 over-cap communities, keep admins + earliest-joined up to
  150; delete the excess. Projected delete = 785.
- **Reseed:** none (existing content is representative after pruning).

## 4. Exact commands run (single guarded transaction)

`/tmp/s87_cleanup.sql` (copied into the container, run via `psql -f`):

```sql
\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE del_matches int; del_members int;
BEGIN
  DELETE FROM requests.matches
  WHERE id IN (
    SELECT id FROM (
      SELECT id, row_number() OVER (PARTITION BY request_id ORDER BY created_at DESC) AS rn
      FROM requests.matches WHERE status IN ('proposed','rejected')
    ) z WHERE rn > 5
  );
  GET DIAGNOSTICS del_matches = ROW_COUNT;

  DELETE FROM communities.members
  WHERE id IN (
    SELECT id FROM (
      SELECT id, row_number() OVER (
               PARTITION BY community_id ORDER BY (role='admin') DESC, joined_at ASC) AS rn
      FROM communities.members
      WHERE community_id IN (
        SELECT c.id FROM communities.communities c
        WHERE (SELECT count(*) FROM communities.members x WHERE x.community_id=c.id) > 150
      )
    ) z WHERE rn > 150
  );
  GET DIAGNOSTICS del_members = ROW_COUNT;

  RAISE NOTICE 'Op1 deleted matches=%  | Op2 deleted members=%', del_matches, del_members;
  IF del_matches NOT BETWEEN 23000 AND 24500 THEN
    RAISE EXCEPTION 'match delete count % outside expected — ROLLING BACK', del_matches; END IF;
  IF del_members NOT BETWEEN 770 AND 800 THEN
    RAISE EXCEPTION 'member delete count % outside expected — ROLLING BACK', del_members; END IF;
END $$;
COMMIT;
```

**Actual rows affected (committed):** `Op1 deleted matches=23622 | Op2 deleted members=785`
(+ 1 cascade-deleted conversation tied to a deleted spam match).

## 5. Post-cleanup verification

| Metric | Before | After |
|---|---|---|
| requests.matches total | 27,473 | **3,856** |
| max matches / request | 876 | **6** |
| communities over 150 | 10 | **0** |
| communities.members total | 6,851 | **6,066** |

Demo now shows a coherent member experience: open requests with a sane handful of offers, every
community at/under the Dunbar cap, completed history intact. This is the data the UX audit (Task 6)
runs against.
