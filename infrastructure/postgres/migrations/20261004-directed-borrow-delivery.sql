-- Directed asks commit their notification intent atomically. Queue acknowledgement is retried
-- independently of the HTTP response; recipient inserts absorb delivery/job retries.
CREATE TABLE IF NOT EXISTS inventory.borrow_notification_outbox (
  request_id UUID PRIMARY KEY REFERENCES requests.help_requests(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  published_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_borrow_notifications_pending
  ON inventory.borrow_notification_outbox (request_id) WHERE delivered_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_directed_notification_recipient
  ON notifications.notifications (user_id, (data->>'request_id'))
  WHERE type = 'directed_request_created';
