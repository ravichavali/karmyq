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

-- 1. Trust edges: within-group, full weight. INCLUDES `stability` (Sprint 68 half-life) — omitting it
--    would reset stable old bonds to the 1.0 default and shrink current_weight in trust_edges_live.
--    Idempotent via the (a,b,community) unique constraint — ON CONFLICT DO NOTHING never clobbers an
--    edge the child formed after the split.
INSERT INTO social_graph.trust_edges
  (user_id_a, user_id_b, community_id, match_completed_count, endorsement_count,
   karma_given_count, event_count, raw_weight, stability, last_interaction_at)
SELECT te.user_id_a, te.user_id_b,
       CASE WHEN aa.assigned_to = 'group_a' THEN sp.child_community_a_id ELSE sp.child_community_b_id END,
       te.match_completed_count, te.endorsement_count, te.karma_given_count, te.event_count,
       te.raw_weight, te.stability, te.last_interaction_at
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

-- 2. Karma: copy each group's parent karma into its child. Idempotency is PER SOURCE ROW (not "child
--    has no karma") so a child that earned karma post-split still gets its missing history repaired,
--    and a re-run can't duplicate: skip a source row only if an identical karma row already exists in
--    the child (same user, time, points, reason, related entity).
WITH src AS (
  SELECT kr.user_id,
         CASE WHEN aa.assigned_to = 'group_a' THEN sp.child_community_a_id ELSE sp.child_community_b_id END AS child_id,
         kr.points, kr.reason, kr.related_entity_id, kr.created_at
  FROM communities.split_proposals sp
  JOIN reputation.karma_records kr ON kr.community_id = sp.community_id
  JOIN communities.split_member_assignments aa ON aa.proposal_id = sp.id AND aa.user_id = kr.user_id
  WHERE sp.status = 'executed'
    AND sp.child_community_a_id IS NOT NULL
    AND sp.child_community_b_id IS NOT NULL
    AND aa.assigned_to IN ('group_a', 'group_b')
)
INSERT INTO reputation.karma_records (user_id, community_id, points, reason, related_entity_id, created_at)
SELECT src.user_id, src.child_id, src.points, src.reason, src.related_entity_id, src.created_at
FROM src
WHERE NOT EXISTS (
  SELECT 1 FROM reputation.karma_records k2
  WHERE k2.community_id = src.child_id
    AND k2.user_id = src.user_id
    AND k2.created_at = src.created_at
    AND k2.points = src.points
    AND k2.related_entity_id IS NOT DISTINCT FROM src.related_entity_id
    AND k2.reason IS NOT DISTINCT FROM src.reason
);
