-- Sprint 85 (ADR-066): Feed vocabulary reconciliation — urgency scale + status lifecycle CHECK
--
-- Part of the Unified Feed model. The canonical request card relies on a single
-- urgency scale and a stable status token set, so this migration reconciles the
-- urgency vocabulary and locks the help_requests status lifecycle with a CHECK.
--
-- DRY-RUN (2026-06-03, demo DB karmyq_prod, 1416 rows) confirmed no live row
-- violates the new CHECKs:
--   urgency: low(618) medium(508) high(289) critical(1)  -> 'critical' remaps to 'urgent'
--   status:  open(1163) completed(245) matched(8)         -> all within the lifecycle set
--
-- URGENCY — three producer vocabularies existed (DB low|medium|high|critical;
-- RequestWizard normal|urgent|critical; triage critical). Reconciled to ONE scale
-- urgent | high | medium | low, with 'critical' -> 'urgent'. Every producer is
-- updated to this scale in the SAME branch (requests.ts VALID_URGENCY, adminActions
-- triage, RequestWizard chips, BrowseTab triage + color map, api.ts type) so nothing
-- writes a value the CHECK would reject.
--
-- STATUS — help_requests uses an open -> dibs_pending -> matched -> completed
-- lifecycle (DEFAULT 'open'), with 'cancelled' as a terminal state. There is NO
-- 'pending' status on help_requests: 'pending'/'proposed' are tokens on the
-- matches/dibs/offers tables. The member-facing "proposed" display token (a request
-- whose offer awaits the requester's acceptance) is DERIVED in the curated handler
-- from request + match state — it is not a stored help_requests status. The complete
-- set of status values written by the codebase is the CHECK set below.
--
-- request_type is unchanged: request_type_enum (generic|ride|borrow|service|event)
-- is already canonical; payload subtypes are a separate concept (no DB change).
--
-- IDEMPOTENT: the UPDATE is a no-op on re-run; DROP CONSTRAINT IF EXISTS guards each
-- ADD. apply-migrations.sh wraps this file in a single BEGIN/COMMIT and tracks it by
-- filename. Applied atomically with the Sprint 85 code via deploy.sh — intentionally
-- NOT pre-applied to demo, so the currently-deployed producers (which still emit
-- 'critical') do not 500 against the new urgency CHECK before the code ships.

-- 1. Urgency: reconcile to one scale (urgent | high | medium | low). Triage 'critical' -> 'urgent'.
UPDATE requests.help_requests SET urgency = 'urgent' WHERE urgency = 'critical';

ALTER TABLE requests.help_requests
  DROP CONSTRAINT IF EXISTS chk_help_requests_urgency;
ALTER TABLE requests.help_requests
  ADD CONSTRAINT chk_help_requests_urgency
    CHECK (urgency IN ('urgent', 'high', 'medium', 'low'));

-- 2. Status: lock the real help_requests lifecycle. No data change (no 'pending' rows exist;
--    every code path writes one of these five tokens).
ALTER TABLE requests.help_requests
  DROP CONSTRAINT IF EXISTS chk_help_requests_status;
ALTER TABLE requests.help_requests
  ADD CONSTRAINT chk_help_requests_status
    CHECK (status IN ('open', 'dibs_pending', 'matched', 'completed', 'cancelled'));
