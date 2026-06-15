-- Sprint 99 — S99-003 release-experience demo-data repair (idempotent).
--
-- The demo carried noisy community names that leaked into dropdowns, ask-scope pickers and
-- provider shared-community badges and made the platform read like a test harness:
--   * "Test 1" / "Test 2" / "Test Community 1779770190663"
--   * "Foster city Cricket Aficianados" (typo + lowercase "city")
--   * 14 communities with a doubled fission suffix, e.g. "… — Group A — Group A"
--
-- These are RENAMES, never deletes: "Test 1"/"Test 2" hold 60+ real members each (and the
-- grandchildren 70-83), so removing them would strand thousands of memberships. Renaming is
-- id-stable — all members, requests, matches and trust edges are preserved. The community name
-- embedded in existing JWTs self-heals on next login.
--
-- Safe to re-run: every statement is guarded by the original value (so it is a no-op once
-- applied) and collision-guarded (never creates a duplicate community name). It is also a no-op
-- on any database that does not contain these seeded demo records.

BEGIN;

-- Typo fix.
UPDATE communities.communities c
SET name = 'Foster City Cricket Aficionados'
WHERE c.name = 'Foster city Cricket Aficianados'
  AND NOT EXISTS (SELECT 1 FROM communities.communities x
                  WHERE x.name = 'Foster City Cricket Aficionados' AND x.id <> c.id);

-- Test-named communities → plausible SF Bay neighbourhood names (members preserved).
UPDATE communities.communities c SET name = 'Bayview Neighbors'
WHERE c.name = 'Test 1'
  AND NOT EXISTS (SELECT 1 FROM communities.communities x
                  WHERE x.name = 'Bayview Neighbors' AND x.id <> c.id);

UPDATE communities.communities c SET name = 'Excelsior Mutual Aid'
WHERE c.name = 'Test 2'
  AND NOT EXISTS (SELECT 1 FROM communities.communities x
                  WHERE x.name = 'Excelsior Mutual Aid' AND x.id <> c.id);

UPDATE communities.communities c SET name = 'Glen Park Community Care'
WHERE c.name = 'Test Community 1779770190663'
  AND NOT EXISTS (SELECT 1 FROM communities.communities x
                  WHERE x.name = 'Glen Park Community Care' AND x.id <> c.id);

-- Stacked fission suffixes: "… — Group A — Group A" → "… — Group AA" (unique + readable).
-- The four grandchildren of each base map to AA / AB / BA / BB, so no rename collides. After the
-- rewrite the name has a single " — Group " segment and the WHERE clause no longer matches it.
UPDATE communities.communities
SET name = regexp_replace(name, '^(.*) — Group (\S+) — Group (\S+)$', '\1 — Group \2\3')
WHERE name ~ ' — Group \S+ — Group \S+$';

COMMIT;
