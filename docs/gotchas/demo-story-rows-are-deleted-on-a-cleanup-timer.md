# The demo's story rows are deleted on a timer, and the deadline is not what it looks like

The guided Maria demo at `karmyq.com/demo` is configured by five `DEMO_*` environment variables.
Four of them are ids pointing at specific rows in `requests.help_requests`, `requests.matches` and
`provider.offers`. **Those rows are deleted on a schedule**, so the configuration goes stale on its
own and every `POST /auth/demo-session` starts returning `503 DEMO_UNAVAILABLE`.

This is not hypothetical. It is BUG-039: the demo — the one page a stranger can see without an
account — was dead from roughly 2026-09-09 to 2026-09-12. A read-only probe run inside
`karmyq-auth-service` on 2026-09-12 reported config entirely healthy (flag exactly `true`, all five
ids set, persona found, active, non-admin) and **all four story rows absent**.

## The deletion is two stages, and the second keys off the first

`services/cleanup-service/src/jobs/expirationJob.ts`:

```sql
-- mark   (hourly, :18-22)
UPDATE requests.help_requests
   SET expired = TRUE, updated_at = CURRENT_TIMESTAMP
 WHERE expires_at <= now AND expired = FALSE AND status = 'open'

-- delete (02:00 daily, :84-88)
DELETE FROM requests.help_requests
 WHERE expired = TRUE AND updated_at <= now - 7 days
```

So the real deadline is **mark-time + 7 days**, and mark-time is not `expires_at`:

- a row is only ever marked while `status = 'open'` — a completed or matched request whose expiry
  has passed is never marked, and this job never deletes it;
- **any later write to `updated_at` restarts the seven days**, moving the deadline later;
- marking lags expiry by up to an hour and deletion by up to a day, so `expires_at + 7 days` is a
  *conservative lower bound*, never the actual date.

Compute the deadline from the live row — branch on `expired` and `status` — rather than from
`expires_at`. Where the conservative estimate is used, say so; presenting it as exact is wrong in
both directions depending on which case you are in. `scripts/check-demo-health.js` does this and
reports a `basis` field (`marked`, `conservative`, `not-deletable`) so an operator can tell a real
running clock from an estimate without re-deriving the SQL.

## What to do instead of letting it rot

Rotate the stories before they age out:

```bash
cd ~/karmyq && set -a && . ./.env.demo.rotation && set +a
npm --workspace @karmyq/simulation-service run rotate:demo-stories -- --apply --publish-config
```

`.github/workflows/demo-health.yml` runs daily and files a labelled issue when a session cannot be
issued **or** the rows are within 14 days of deletion. It is read-only and never rotates for you.

## Why nobody noticed for days

Two reinforcing reasons, both worth knowing before debugging this class of failure again:

1. **The endpoint is opaque by design and was opaque to the operator too.** ADR-084 collapses all
   fourteen failure causes into one 503, and `routes/auth.ts` logged only failures that were *not*
   `DemoSessionUnavailableError` — so every expected cause was silent. BUG-039's own advice to check
   `pm2 logs` could not have worked. Fixed in Sprint 129 (ADR-084 amendment); the reason is now
   logged at `warn` while the response stays byte-identical.
2. **The documented safety mechanism was never operational.** `docs/guides/demo-data.md` has said
   since Sprint 117 that the stories are "rotated explicitly before they age out", and
   `rotate:demo-stories` existed to do it — but simulation-service is not deployed on the demo host
   and `.env.demo.example` carried none of the five variables rotation requires. The promise in the
   guide could not be kept by the repo as it stood.
