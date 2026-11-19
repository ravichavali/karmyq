-- One statement is atomic with both the tracked transaction applier and CI's autocommit replay.
DO $migration$
BEGIN
  ALTER TABLE communities.governance_nominations
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

  ALTER TABLE communities.governance_nominations
    ALTER COLUMN expires_at SET DEFAULT (now() + interval '30 days');

  UPDATE communities.governance_nominations
  SET expires_at = created_at + interval '30 days'
  WHERE quorum_policy_version = 1 AND expires_at IS NULL;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'governance_expiry_metadata'
    AND conrelid = 'communities.governance_nominations'::regclass) THEN
    ALTER TABLE communities.governance_nominations ADD CONSTRAINT governance_expiry_metadata CHECK (
      quorum_policy_version IS NULL
      OR (expires_at IS NOT NULL AND expires_at > created_at)
    );
  END IF;

  ALTER TABLE communities.governance_nominations DROP CONSTRAINT IF EXISTS valid_nomination_status;
  ALTER TABLE communities.governance_nominations ADD CONSTRAINT valid_nomination_status CHECK (status IN (
    'pending', 'ratified', 'rejected', 'withdrawn', 'declined', 'expired'
  ));

  CREATE OR REPLACE FUNCTION communities.require_governance_protocol_v1()
  RETURNS trigger LANGUAGE plpgsql AS $guard$
  BEGIN
    IF TG_TABLE_NAME = 'governance_ratifications' THEN
      IF current_setting('app.governance_policy_version', true) IS DISTINCT FROM '1' THEN
        RAISE EXCEPTION 'GOVERNANCE_PROTOCOL_REQUIRED' USING ERRCODE = '23514';
      END IF;
      IF EXISTS (
        SELECT 1 FROM communities.governance_nominations
        WHERE id = NEW.nomination_id AND expires_at <= now()
      ) THEN
        RAISE EXCEPTION 'GOVERNANCE_NOMINATION_EXPIRED' USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END IF;
    IF TG_OP = 'INSERT' OR NEW.status = 'ratified' THEN
      IF current_setting('app.governance_policy_version', true) IS DISTINCT FROM '1' THEN
        RAISE EXCEPTION 'GOVERNANCE_PROTOCOL_REQUIRED' USING ERRCODE = '23514';
      END IF;
      IF TG_TABLE_NAME = 'governance_nominations' THEN
        IF NEW.quorum_policy_version IS DISTINCT FROM 1 OR NEW.electorate_size IS NULL THEN
          RAISE EXCEPTION 'GOVERNANCE_POLICY_METADATA_REQUIRED' USING ERRCODE = '23514';
        END IF;
        IF NEW.status = 'ratified' AND NEW.expires_at <= now() THEN
          RAISE EXCEPTION 'GOVERNANCE_NOMINATION_EXPIRED' USING ERRCODE = '23514';
        END IF;
      END IF;
    END IF;
    RETURN NEW;
  END;
  $guard$;
END;
$migration$;

COMMENT ON COLUMN communities.members.status IS 'active: member; pending: awaiting approval; invited: has invite; left: the member left and may self-rejoin; inactive: removed or rejected by staff (staff reactivation only)';
