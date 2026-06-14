-- Sprint 98 (BUG-098-006 / trust-truth audit): remove orphaned 'exchange' connections.
--
-- social_graph.connections rows of type='exchange' are written ONLY on the match_completed
-- event (social-graph-service/src/events/subscriber.ts) and are meant to mean "these two
-- users have completed a help exchange." The table has NO foreign key to requests.matches,
-- so the Sprint 87 demo de-spam — which deleted help_requests and cascade-deleted their
-- matches — left exchange connections behind with no completed match to back them. The
-- Sprint 98 audit (scripts/audit-trust-truth.sql, check 2) found 343 such orphans.
--
-- Impact: these orphans surface as a "direct connection" trust-context label on the dibs
-- first-ask prompt (request-service getMutualAidCandidates -> DibsPrompt) — claiming a
-- completed exchange that never happened. They do NOT affect trust paths or the trust graph
-- (pathComputation builds its adjacency from requests.matches, not connections).
--
-- Safe + idempotent: connections are a derived cache, re-created on the next match_completed
-- between the pair. Deleting rows with no backing completed match can only converge toward
-- truth; re-running deletes only any new orphans (normally none).

DELETE FROM social_graph.connections sg
WHERE sg.type = 'exchange'
  AND NOT EXISTS (
    SELECT 1
    FROM requests.matches m
    JOIN requests.help_requests hr ON hr.id = m.request_id
    WHERE m.status = 'completed'
      AND (
        (hr.requester_id = sg.user_a_id AND m.responder_id = sg.user_b_id)
        OR (hr.requester_id = sg.user_b_id AND m.responder_id = sg.user_a_id)
      )
  );
