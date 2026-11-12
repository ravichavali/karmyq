-- Sprint 141 (BUG-073, ADR-105): platform admins are designated explicitly, never inherited from a community role.
CREATE TABLE IF NOT EXISTS auth.platform_admins (
    user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    granted_at timestamptz NOT NULL DEFAULT now(),
    note       text
);

COMMENT ON TABLE auth.platform_admins IS
    'Platform admins (ADR-105). Granted and revoked by operator SQL only. A row gives platform-wide powers and no community role.';
