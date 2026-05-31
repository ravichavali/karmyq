-- Sprint 77 (ADR-062): Community De-duplication — one-time data repair
--
-- The simulation minted duplicate communities (non-idempotent POST /communities
-- against ~23 fixed templates → 707 rows, only ~23 distinct identities). This
-- script collapses every duplicate onto a single canonical survivor per identity
-- (LOWER(TRIM(name)), LOWER(TRIM(COALESCE(location,'')))), re-parenting ALL
-- child rows that reference communities.communities(id) before deleting the now
-- redundant duplicates, then enforces uniqueness with a partial index.
--
-- WHY re-parent BEFORE delete: nearly every community_id FK is ON DELETE CASCADE.
-- Deleting a duplicate first would cascade away its members / requests / trust
-- edges. Order is: canonical map → re-parent children → recompute → delete dups
-- → create unique index.
--
-- FK discovery is catalog-driven (pg_constraint / pg_index): we do NOT hard-code
-- the child-table list (28+ tables carry community_id). For tables whose unique
-- constraint involves the FK column, colliding child rows are deleted before the
-- re-parent UPDATE (so the move can't violate the unique constraint). This also
-- correctly handles the 1:1 tables (community_configs, community_trust_scores):
-- the canonical row is kept and duplicate rows dropped.
--
-- USAGE:
--   Dry run (rolls back, prints NOTICE counts):
--     psql -U karmyq_prod -d karmyq_prod -v dryrun=1 -f 20260530-community-dedup.sql
--   For real (commits inside one transaction):
--     psql -U karmyq_prod -d karmyq_prod -v dryrun=0 -f 20260530-community-dedup.sql
--
-- SECURITY: all dynamic SQL is built from catalog identifiers (regclass / %I),
-- never from user input. There is no untrusted data in this migration.

-- Default dryrun=1 (safe) when not provided on the command line.
\if :{?dryrun}
\else
  \set dryrun 1
\endif
\echo '=== community-dedup migration | dryrun =' :dryrun '==='

BEGIN;

DO $$
DECLARE
  fk            RECORD;
  uidx          RECORD;
  other_cols    TEXT[];
  match_pred    TEXT;
  del_sql       TEXT;
  upd_sql       TEXT;
  n_groups      BIGINT;
  n_before      BIGINT;
  n_dups        BIGINT;
  n_after       BIGINT;
  n_deleted     BIGINT;
  n_updated     BIGINT;
BEGIN
  ------------------------------------------------------------------
  -- 1. Build the canonical map: dup_id -> canonical_id (oldest wins,
  --    tie-broken by lowest id), over ACTIVE communities only.
  ------------------------------------------------------------------
  CREATE TEMP TABLE canonical_map ON COMMIT DROP AS
  WITH grouped AS (
    SELECT
      id,
      first_value(id) OVER (
        PARTITION BY LOWER(TRIM(name)), LOWER(TRIM(COALESCE(location, '')))
        ORDER BY created_at ASC, id ASC
      ) AS canonical_id
    FROM communities.communities
    WHERE status = 'active'
  )
  SELECT id AS dup_id, canonical_id
  FROM grouped
  WHERE id <> canonical_id;

  CREATE INDEX ON canonical_map (dup_id);

  SELECT count(*) INTO n_before FROM communities.communities WHERE status = 'active';
  SELECT count(*) INTO n_dups   FROM canonical_map;
  SELECT count(*) INTO n_groups FROM (
    SELECT 1 FROM communities.communities
    WHERE status = 'active'
    GROUP BY LOWER(TRIM(name)), LOWER(TRIM(COALESCE(location, '')))
  ) g;

  RAISE NOTICE 'Active communities before: %, duplicates to merge: %, distinct identities (groups): %',
    n_before, n_dups, n_groups;

  IF n_dups = 0 THEN
    RAISE NOTICE 'No duplicates found — nothing to re-parent or delete.';
  END IF;

  ------------------------------------------------------------------
  -- 2. Discover every SINGLE-COLUMN FK referencing communities.communities(id).
  ------------------------------------------------------------------
  CREATE TEMP TABLE community_fks ON COMMIT DROP AS
  SELECT con.conrelid::regclass::text AS child_tbl,
         att.attname::text            AS child_col
  FROM pg_constraint con
  JOIN pg_attribute att
    ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
  JOIN pg_attribute ratt
    ON ratt.attrelid = con.confrelid AND ratt.attnum = con.confkey[1]
  WHERE con.contype = 'f'
    AND con.confrelid = 'communities.communities'::regclass
    AND ratt.attname = 'id'
    AND array_length(con.conkey, 1) = 1;

  -- These auth.* columns hold community ids but were never given an FK
  -- constraint (the "will reference … after it's created" FK was never added),
  -- so catalog discovery misses them and their rows would dangle after the dup
  -- delete. Add them explicitly so the re-parent loop (2b) repairs them too,
  -- with the same collision-safe handling for their composite UNIQUE keys.
  INSERT INTO community_fks (child_tbl, child_col)
  SELECT to_regclass(t)::text, 'community_id'
  FROM (VALUES
    ('auth.user_invitations'),
    ('auth.social_distances'),
    ('auth.inviter_stats')
  ) AS v(t)
  WHERE to_regclass(t) IS NOT NULL;

  ------------------------------------------------------------------
  -- 2a. Relationship tables with >=2 FKs to communities (community_links,
  --     community_trust_edges, fusion_proposals, split_proposals) couple
  --     their community columns with CHECK (a<>b) / ordering / composite-unique
  --     constraints. Re-parenting those columns independently would create
  --     self-references and violate the coupled constraints (aborting the
  --     transaction). The rows themselves are inter-duplicate sim artifacts, so
  --     delete any row that references a DUPLICATE in ANY of its community
  --     columns; canonical communities keep relationship rows that point only at
  --     surviving communities. (community_trust_edges is a recomputable
  --     aggregate.) These tables are then EXCLUDED from the re-parent loop (2b).
  ------------------------------------------------------------------
  FOR fk IN
    SELECT child_tbl, array_agg(child_col) AS cols
    FROM community_fks
    GROUP BY child_tbl
    HAVING count(*) >= 2
  LOOP
    SELECT string_agg(format('t.%I = cm.dup_id', c), ' OR ')
      INTO match_pred
    FROM unnest(fk.cols) AS c;

    del_sql := format($q$
      DELETE FROM %1$s t
      USING canonical_map cm
      WHERE %2$s
    $q$, fk.child_tbl, match_pred);
    EXECUTE del_sql;
    GET DIAGNOSTICS n_deleted = ROW_COUNT;
    RAISE NOTICE '  [%] deleted % inter-duplicate relationship row(s) across columns %',
      fk.child_tbl, n_deleted, fk.cols;
  END LOOP;

  ------------------------------------------------------------------
  -- 2b. Re-parent the single-FK child tables (one FK to communities) onto
  --     their canonical community.
  ------------------------------------------------------------------
  FOR fk IN
    SELECT child_tbl, child_col
    FROM community_fks
    WHERE child_tbl IN (
      SELECT child_tbl FROM community_fks GROUP BY child_tbl HAVING count(*) = 1
    )
    ORDER BY child_tbl
  LOOP
    -- For each UNIQUE index on this table that includes the FK column,
    --     delete child rows that would collide once re-parented onto canonical.
    FOR uidx IN
      SELECT i.indexrelid,
             array_agg(a.attname ORDER BY a.attnum) AS cols
      FROM pg_index i
      JOIN pg_attribute a
        ON a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey)
      WHERE i.indrelid = fk.child_tbl::regclass
        AND i.indisunique
        AND i.indpred IS NULL          -- skip partial unique indexes
        AND 0 <> ALL (i.indkey)        -- skip expression indexes (would drop key cols)
      GROUP BY i.indexrelid
      HAVING fk.child_col = ANY (array_agg(a.attname))
    LOOP
      other_cols := array_remove(uidx.cols, fk.child_col);

      -- The post-re-parent unique key is (canonical_id, other_cols). Collisions
      -- arise not only against rows already on the canonical, but ALSO among
      -- multiple duplicates that share the same other-cols (e.g. a user who is a
      -- member of two duplicates of the same group). Rank every row by its TARGET
      -- key — target community = canonical_id if the row is on a duplicate, else
      -- its own community_id — and delete all but the first per key, preferring to
      -- keep the row already on a non-duplicate community (cm.canonical_id IS NULL).
      -- For 1:1 tables (other_cols empty) this keeps exactly one row per canonical.
      IF array_length(other_cols, 1) IS NULL THEN
        match_pred := '';   -- partition by target community only
      ELSE
        SELECT ', ' || string_agg(format('t.%I', c), ', ')
          INTO match_pred
        FROM unnest(other_cols) AS c;
      END IF;

      del_sql := format($q$
        WITH ranked AS (
          SELECT t.ctid AS _ctid,
                 row_number() OVER (
                   PARTITION BY COALESCE(cm.canonical_id, t.%2$I)%3$s
                   ORDER BY (cm.canonical_id IS NULL) DESC, t.ctid
                 ) AS rn
          FROM %1$s t
          LEFT JOIN canonical_map cm ON t.%2$I = cm.dup_id
        )
        DELETE FROM %1$s t USING ranked
        WHERE t.ctid = ranked._ctid AND ranked.rn > 1
      $q$, fk.child_tbl, fk.child_col, match_pred);

      EXECUTE del_sql;
      GET DIAGNOSTICS n_deleted = ROW_COUNT;
      IF n_deleted > 0 THEN
        RAISE NOTICE '  [%] deleted % colliding row(s) before re-parent (unique idx %)',
          fk.child_tbl, n_deleted, uidx.indexrelid::regclass;
      END IF;
    END LOOP;

    -- Re-parent the surviving child rows onto the canonical community.
    upd_sql := format($q$
      UPDATE %1$s t
      SET %2$I = cm.canonical_id
      FROM canonical_map cm
      WHERE t.%2$I = cm.dup_id
    $q$, fk.child_tbl, fk.child_col);

    EXECUTE upd_sql;
    GET DIAGNOSTICS n_updated = ROW_COUNT;
    RAISE NOTICE '  [%] re-parented % row(s) via column %', fk.child_tbl, n_updated, fk.child_col;
  END LOOP;

  ------------------------------------------------------------------
  -- 3. Recompute current_members on the canonical survivors.
  ------------------------------------------------------------------
  UPDATE communities.communities c
  SET current_members = (
    SELECT count(*) FROM communities.members m
    WHERE m.community_id = c.id AND m.status = 'active'
  )
  WHERE c.id IN (SELECT DISTINCT canonical_id FROM canonical_map);

  ------------------------------------------------------------------
  -- 4. Delete the now-empty duplicate communities.
  ------------------------------------------------------------------
  DELETE FROM communities.communities WHERE id IN (SELECT dup_id FROM canonical_map);
  GET DIAGNOSTICS n_deleted = ROW_COUNT;
  RAISE NOTICE 'Deleted % duplicate community row(s).', n_deleted;

  SELECT count(*) INTO n_after FROM communities.communities WHERE status = 'active';
  RAISE NOTICE 'Active communities after: % (expected = distinct identities = %)', n_after, n_groups;

  ------------------------------------------------------------------
  -- 5. Enforce identity uniqueness going forward (partial: active only,
  --    so archived/split/fused names remain re-creatable).
  ------------------------------------------------------------------
  CREATE UNIQUE INDEX IF NOT EXISTS idx_communities_identity_active
    ON communities.communities (LOWER(TRIM(name)), LOWER(TRIM(COALESCE(location, ''))))
    WHERE status = 'active';
  RAISE NOTICE 'Ensured partial unique index idx_communities_identity_active.';
END
$$;

\if :dryrun
  ROLLBACK;
  \echo '=== DRY RUN complete — transaction ROLLED BACK, no changes persisted ==='
\else
  COMMIT;
  \echo '=== COMMITTED — community de-duplication applied ==='
\endif
