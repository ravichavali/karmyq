-- Sprint 99 — S99-003 release-experience demo-data audit (READ ONLY).
--
-- Surfaces the noisy demo communities that leak into dropdowns, ask-scope pickers and provider
-- shared-community badges and hurt the evaluator's first impression. Run this BEFORE and AFTER
-- the repair migration and record the counts in docs/bugs/sprint-99-release-experience-audit.md.
--
-- Schema note (memory reference_demo_ux_audit_access): the schema is communities.communities /
-- communities.members (plural); communities.members has 0 referencing FKs.

\echo '== Test / junk-named communities =='
SELECT c.id, c.name, c.created_at,
       (SELECT count(*) FROM communities.members m WHERE m.community_id = c.id) AS member_count
FROM communities.communities c
WHERE c.name ~* '^test( |$|[0-9])'
   OR c.name ILIKE 'test %'
ORDER BY c.name;

\echo '== Typo communities (Aficianados / lowercase "city") =='
SELECT c.id, c.name, c.created_at,
       (SELECT count(*) FROM communities.members m WHERE m.community_id = c.id) AS member_count
FROM communities.communities c
WHERE c.name ILIKE '%Aficianados%'
   OR c.name LIKE 'Foster city %'
ORDER BY c.name;

\echo '== Stacked fission suffixes (two or more "— Group X") =='
SELECT c.id, c.name, c.created_at,
       (SELECT count(*) FROM communities.members m WHERE m.community_id = c.id) AS member_count
FROM communities.communities c
WHERE c.name ~ '(—|-)\s*Group\s+\S+.*(—|-)\s*Group\s+\S+'
ORDER BY c.name;

\echo '== Reference: total communities + members =='
SELECT (SELECT count(*) FROM communities.communities) AS communities,
       (SELECT count(*) FROM communities.members)     AS members;
