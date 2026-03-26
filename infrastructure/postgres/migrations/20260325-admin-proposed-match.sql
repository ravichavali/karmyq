-- Sprint 40: Add admin_proposed flag to matches
-- Lets the frontend distinguish admin-suggested matches from self-initiated ones

ALTER TABLE requests.matches
  ADD COLUMN IF NOT EXISTS admin_proposed BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN requests.matches.admin_proposed IS
  'TRUE when the match was created by a community admin via POST /requests/:id/propose-match';
