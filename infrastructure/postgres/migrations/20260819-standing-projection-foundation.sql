-- Sprint 126 — standing projection foundation (ADR-096).
--
-- Two independent problems, both of which must be fixed before any completed-match history can be
-- replayed through production standing math.
--
-- 1. ZERO-STANDING SEMANTICS DISAGREE WITH THEMSELVES.
--    reputation.trust_scores.score was `integer DEFAULT 50` and nullable, while every read path
--    treats a MISSING row as 0 — ADR-095's provider reach gate fails closed through
--    COALESCE(ts.score, 0) (services/request-service/src/services/providerReachService.ts:95-128).
--    So two members with identical (empty) history score 0 or 50 depending only on whether some
--    earlier codepath happened to insert a row. ADR-095 recorded this as deferred; Sprint 126
--    resolves it. After this migration a stored cold-start row and a missing row agree at 0.
--
--    Note this changes the DEFAULT for NEW rows only. Existing rows keep whatever score they hold;
--    the Sprint 126 backfill recalculates every active membership through the ADR-037 calculator.
--
--    The `SET NOT NULL` aborts if any row currently holds NULL, so NULLs are first resolved to 0 —
--    the same value the read paths already infer for them. This is not a score change: it writes
--    down the value those rows were already being read as.
--
-- 2. PROJECTION HAD NO IDENTITY, SO REPLAY COULD NOT BE IDEMPOTENT.
--    Completed-match standing is a projection of a fact that already happened. Replaying the same
--    match — a Bull retry, an interrupted backfill batch, a re-run of the operator CLI — must be a
--    no-op, and that guarantee has to live in PostgreSQL. A CLI checkpoint file or a
--    SELECT-then-INSERT check cannot survive a crash between the check and the write.
--
--    The identity is (user_id, community_id, reason, related_entity_id) for karma and
--    (user_id, community_id, activity_type, related_entity_id) for activity. Both indexes are
--    PARTIAL on `related_entity_id IS NOT NULL`, because only rows attributable to a source entity
--    have a projection identity at all. Manual adjustments and other non-projected rows carry a
--    NULL related_entity_id and stay unconstrained — several may legitimately be identical.
--
--    The identity deliberately includes `reason`/`activity_type`: one match legitimately writes
--    several rows for the same user in the same community ('Provided help' plus
--    'First help in community'), and those are distinct projections of the same fact.
--
-- ⚠️ PRE-DEPLOY REQUIREMENT: CREATE UNIQUE INDEX does not tolerate pre-existing duplicate data —
--    IF NOT EXISTS guards against the index already existing, NOT against duplicate rows, and a
--    conflict aborts the migration and rolls the deploy back. The duplicate-identity count was 0 in
--    the 2026-08-19 demo audit, but that is a snapshot and the non-idempotent write path this
--    sprint replaces is exactly what would create one. Re-measure immediately before deploying and
--    resolve any duplicates as their own authorized data operation first.
--
--    Deliberately NOT deduplicated here: collapsing duplicates is a data repair that must preserve
--    points and created_at, and it belongs to the dry-run-first backfill CLI, not to a migration
--    that runs unattended during deploy.
--
-- Every writer that copies karma rows was made conflict-safe before this migration landed:
-- fusionService.ts and fissionService.ts carry karma between communities and can legitimately meet
-- the same identity twice.
--
-- Idempotent: safe to re-run (IF NOT EXISTS; the ALTERs are naturally idempotent).

UPDATE reputation.trust_scores SET score = 0 WHERE score IS NULL;

ALTER TABLE reputation.trust_scores
  ALTER COLUMN score SET DEFAULT 0,
  ALTER COLUMN score SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_karma_match_projection
  ON reputation.karma_records (user_id, community_id, reason, related_entity_id)
  WHERE related_entity_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_activity_match_projection
  ON reputation.activity_log (user_id, community_id, activity_type, related_entity_id)
  WHERE related_entity_id IS NOT NULL;

-- 3. THE TRUST CALCULATOR SELF-JOINS ON A COLUMN WITH NO INDEX.
--    `trustMetricsDb` derives repeat-interaction pairs and distinct counterparties by joining
--    karma_records to itself on `other.related_entity_id = me.related_entity_id` — i.e. "who else
--    was awarded for the same match". No index led on that column: karma_records carried only
--    (id), (community_id), (user_id), and the projection identity above leads with user_id. So
--    every trust-score computation hashed or scanned the whole table for the inner side.
--
--    This is not backfill-specific — it runs on every live match completion too — but the backfill
--    makes it acute: ~31,000 executions against a table growing from 174 toward ~20,000 rows, which
--    is what makes the tail of a replay far slower than the head.
--
--    Partial for the same reason as the identities above: rows with no source entity are never the
--    subject of this join.
CREATE INDEX IF NOT EXISTS idx_karma_related_entity
  ON reputation.karma_records (related_entity_id)
  WHERE related_entity_id IS NOT NULL;
