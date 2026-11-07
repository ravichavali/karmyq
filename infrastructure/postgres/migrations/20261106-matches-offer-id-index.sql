-- Sprint 138 (BUG-095): index the offer-release guards' NOT EXISTS (... m.offer_id = o.id ...) and D2's sweep.
-- Plain CREATE INDEX: scripts/apply-migrations.sh runs each file inside BEGIN ... COMMIT, where CONCURRENTLY is refused.
CREATE INDEX IF NOT EXISTS idx_matches_offer_id
    ON requests.matches USING btree (offer_id)
    WHERE offer_id IS NOT NULL;
