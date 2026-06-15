-- Sprint 99 — S99-003 release-experience demo-data repair (idempotent, manual).
--
-- DELIBERATELY NOT a migration: it lives in scripts/ (not infrastructure/postgres/migrations/) so
-- deploy.sh / apply-migrations.sh do NOT auto-apply it on every deploy or on fresh databases. It is
-- demo-data-specific and is run manually as a post-deploy step:
--
--   docker exec karmyq-postgres sh -c \
--     'PGPASSWORD=$POSTGRES_PASSWORD psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
--        -f /tmp/repair-release-experience-demo-data.sql'
--
-- The demo carried noisy community names that leaked into dropdowns, ask-scope pickers and provider
-- shared-community badges and made the platform read like a test harness:
--   * "Test 1" / "Test 2" / "Test Community 1779770190663"
--   * "Foster city Cricket Aficianados" (typo + lowercase "city")
--   * 14 communities with a doubled fission suffix, e.g. "… — Group A — Group A"
--
-- These are RENAMES, never deletes: "Test 1"/"Test 2" hold 60+ real members each (and the
-- grandchildren 70-83), so removing them would strand thousands of memberships. Renaming is
-- id-stable — all members, requests, matches and trust edges are preserved. The community name
-- embedded in existing JWTs self-heals on next login.
--
-- Idempotent + collision-safe: every statement is guarded against the active-identity unique index
-- idx_communities_identity_active = (LOWER(TRIM(name)), LOWER(TRIM(COALESCE(location,'')))) WHERE
-- status='active'. A rename that would collide with an existing active community at the same
-- location is skipped (left as-is) rather than failing the script. Re-running is a no-op, and it is
-- a no-op on any database that does not contain these seeded demo records.

\echo '== S99-003 repair: BEFORE =='
\i scripts/audit-release-experience.sql

BEGIN;

-- Helper predicate inlined per statement: NOT EXISTS another ACTIVE community whose normalized
-- (name, location) already equals the target — mirrors idx_communities_identity_active.

-- Typo fix.
UPDATE communities.communities c
SET name = 'Foster City Cricket Aficionados'
WHERE c.name = 'Foster city Cricket Aficianados'
  AND NOT EXISTS (SELECT 1 FROM communities.communities x
                  WHERE x.id <> c.id AND x.status = 'active'
                    AND LOWER(TRIM(x.name)) = LOWER('Foster City Cricket Aficionados')
                    AND LOWER(TRIM(COALESCE(x.location, ''))) = LOWER(TRIM(COALESCE(c.location, ''))));

-- Test-named communities → plausible SF Bay neighbourhood names (members preserved).
UPDATE communities.communities c SET name = 'Bayview Neighbors'
WHERE c.name = 'Test 1'
  AND NOT EXISTS (SELECT 1 FROM communities.communities x
                  WHERE x.id <> c.id AND x.status = 'active'
                    AND LOWER(TRIM(x.name)) = LOWER('Bayview Neighbors')
                    AND LOWER(TRIM(COALESCE(x.location, ''))) = LOWER(TRIM(COALESCE(c.location, ''))));

UPDATE communities.communities c SET name = 'Excelsior Mutual Aid'
WHERE c.name = 'Test 2'
  AND NOT EXISTS (SELECT 1 FROM communities.communities x
                  WHERE x.id <> c.id AND x.status = 'active'
                    AND LOWER(TRIM(x.name)) = LOWER('Excelsior Mutual Aid')
                    AND LOWER(TRIM(COALESCE(x.location, ''))) = LOWER(TRIM(COALESCE(c.location, ''))));

UPDATE communities.communities c SET name = 'Glen Park Community Care'
WHERE c.name = 'Test Community 1779770190663'
  AND NOT EXISTS (SELECT 1 FROM communities.communities x
                  WHERE x.id <> c.id AND x.status = 'active'
                    AND LOWER(TRIM(x.name)) = LOWER('Glen Park Community Care')
                    AND LOWER(TRIM(COALESCE(x.location, ''))) = LOWER(TRIM(COALESCE(c.location, ''))));

-- Stacked fission suffixes: "… — Group A — Group A" → "… — Group AA" (unique + readable).
-- The four grandchildren of each base map to AA / AB / BA / BB, so the targets do not collide with
-- each other; the NOT EXISTS guard additionally skips any row whose target already exists active at
-- the same location. After the rewrite the name has a single " — Group " segment and the WHERE
-- clause no longer matches it (idempotent).
UPDATE communities.communities c
SET name = regexp_replace(c.name, '^(.*) — Group (\S+) — Group (\S+)$', '\1 — Group \2\3')
WHERE c.name ~ ' — Group \S+ — Group \S+$'
  AND NOT EXISTS (
    SELECT 1 FROM communities.communities x
    WHERE x.id <> c.id AND x.status = 'active'
      AND LOWER(TRIM(x.name)) = LOWER(TRIM(regexp_replace(c.name, '^(.*) — Group (\S+) — Group (\S+)$', '\1 — Group \2\3')))
      AND LOWER(TRIM(COALESCE(x.location, ''))) = LOWER(TRIM(COALESCE(c.location, '')))
  );

COMMIT;

\echo '== S99-003 repair: AFTER (all groups should be empty) =='
\i scripts/audit-release-experience.sql
