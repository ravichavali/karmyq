-- Sprint 86 follow-up: carry trust edges + karma into already-split child communities
--
-- executeSplit historically moved members to child communities but left their trust edges
-- (social_graph.trust_edges) and karma (reputation.karma_records) under the parent community_id,
-- so each child started at 0 — connections "vanished" even though the split was clustered on
-- strong bonds. The code fix (fissionService) now carries them on future splits; this one-time
-- repair backfills communities that already split.
--
-- For every executed split, copy WITHIN-GROUP parent trust edges (both endpoints assigned to the
-- same child) into that child at FULL weight, and copy that group's karma into the child. Cross-group
-- trust is intentionally left to the split_origin community_link (0.40), unchanged here.

-- 1. Trust edges: within-group, full weight. Idempotent via the (a,b,community) unique constraint —
--    ON CONFLICT DO NOTHING never clobbers an edge the child formed after the split.
INSERT INTO social_graph.trust_edges
  (user_id_a, user_id_b, community_id, match_completed_count, endorsement_count,
   karma_given_count, event_count, raw_weight, last_interaction_at)
SELECT te.user_id_a, te.user_id_b,
       CASE WHEN aa.assigned_to = 'group_a' THEN sp.child_community_a_id ELSE sp.child_community_b_id END,
       te.match_completed_count, te.endorsement_count, te.karma_given_count, te.event_count,
       te.raw_weight, te.last_interaction_at
FROM communities.split_proposals sp
JOIN social_graph.trust_edges te ON te.community_id = sp.community_id
JOIN communities.split_member_assignments aa ON aa.proposal_id = sp.id AND aa.user_id = te.user_id_a
JOIN communities.split_member_assignments bb ON bb.proposal_id = sp.id AND bb.user_id = te.user_id_b
WHERE sp.status = 'executed'
  AND sp.child_community_a_id IS NOT NULL
  AND sp.child_community_b_id IS NOT NULL
  AND aa.assigned_to = bb.assigned_to              -- both endpoints in the SAME child
  AND aa.assigned_to IN ('group_a', 'group_b')
ON CONFLICT (user_id_a, user_id_b, community_id) DO NOTHING;

-- 2. Karma: copy each group's parent karma into its child. Idempotency guard: only backfill a child
--    that currently has NO karma records (a freshly-split child that lost its history). A child that
--    has since accrued karma is left untouched, so re-running never duplicates the ledger.
INSERT INTO reputation.karma_records (user_id, community_id, points, reason, related_entity_id, created_at)
SELECT kr.user_id,
       CASE WHEN aa.assigned_to = 'group_a' THEN sp.child_community_a_id ELSE sp.child_community_b_id END,
       kr.points, kr.reason, kr.related_entity_id, kr.created_at
FROM communities.split_proposals sp
JOIN reputation.karma_records kr ON kr.community_id = sp.community_id
JOIN communities.split_member_assignments aa ON aa.proposal_id = sp.id AND aa.user_id = kr.user_id
WHERE sp.status = 'executed'
  AND sp.child_community_a_id IS NOT NULL
  AND sp.child_community_b_id IS NOT NULL
  AND aa.assigned_to IN ('group_a', 'group_b')
  AND NOT EXISTS (
    SELECT 1 FROM reputation.karma_records k2
    WHERE k2.community_id =
      (CASE WHEN aa.assigned_to = 'group_a' THEN sp.child_community_a_id ELSE sp.child_community_b_id END)
  );
