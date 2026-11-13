-- One statement is atomic with both the tracked transaction applier and CI's autocommit replay.
DO $migration$
BEGIN
  -- Old voters insert a ballot before reading/updating the nomination. Lock in that order
  -- so an in-flight old vote can finish before the cutoff rather than deadlocking on its read.
  LOCK TABLE communities.governance_ratifications, communities.governance_nominations IN ACCESS EXCLUSIVE MODE;

  ALTER TABLE communities.governance_nominations
    ADD COLUMN IF NOT EXISTS quorum_policy_version SMALLINT,
    ADD COLUMN IF NOT EXISTS electorate_size INTEGER;

  UPDATE communities.governance_nominations
  SET status = 'withdrawn', resolved_at = NOW()
  WHERE status = 'pending' AND quorum_policy_version IS NULL;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'governance_quorum_metadata'
    AND conrelid = 'communities.governance_nominations'::regclass) THEN
    ALTER TABLE communities.governance_nominations ADD CONSTRAINT governance_quorum_metadata CHECK (
      (quorum_policy_version IS NULL AND electorate_size IS NULL)
      OR (quorum_policy_version IS NOT NULL AND electorate_size IS NOT NULL
        AND quorum_policy_version = 1 AND electorate_size >= 3
        AND required_ratifications = GREATEST(3, CEIL(electorate_size::numeric / 5)))
    );
  END IF;

  CREATE UNIQUE INDEX IF NOT EXISTS governance_one_pending_role
    ON communities.governance_nominations(community_id, nominated_user_id, nominated_for_role)
    WHERE status = 'pending';

  CREATE TABLE IF NOT EXISTS communities.governance_nomination_voters (
    nomination_id UUID NOT NULL REFERENCES communities.governance_nominations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    PRIMARY KEY (nomination_id, user_id)
  );

  CREATE OR REPLACE FUNCTION communities.require_governance_protocol_v1()
  RETURNS trigger LANGUAGE plpgsql AS $guard$
  BEGIN
    IF TG_TABLE_NAME = 'governance_ratifications' THEN
      IF current_setting('app.governance_policy_version', true) IS DISTINCT FROM '1' THEN
        RAISE EXCEPTION 'GOVERNANCE_PROTOCOL_REQUIRED' USING ERRCODE = '23514';
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
      END IF;
    END IF;
    RETURN NEW;
  END;
  $guard$;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'governance_nomination_protocol'
    AND tgrelid = 'communities.governance_nominations'::regclass) THEN
    CREATE TRIGGER governance_nomination_protocol
      BEFORE INSERT OR UPDATE OF status ON communities.governance_nominations
      FOR EACH ROW EXECUTE FUNCTION communities.require_governance_protocol_v1();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'governance_ballot_protocol'
    AND tgrelid = 'communities.governance_ratifications'::regclass) THEN
    CREATE TRIGGER governance_ballot_protocol
      BEFORE INSERT ON communities.governance_ratifications
      FOR EACH ROW EXECUTE FUNCTION communities.require_governance_protocol_v1();
  END IF;
END;
$migration$;
