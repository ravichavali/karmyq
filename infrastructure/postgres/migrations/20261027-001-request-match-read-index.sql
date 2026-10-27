-- Read-boundary responder checks use both keys, without a lifecycle restriction: historical
-- responders keep read access. Retain the individual indexes for their other query shapes.
CREATE INDEX IF NOT EXISTS idx_matches_request_responder
  ON requests.matches (request_id, responder_id);
