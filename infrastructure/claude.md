# Infrastructure Directory

Docker orchestration, the PostgreSQL schema, nginx routing, and the observability stack.

```
docker/         compose files (dev, test, qa, staging, prod, observability) + registry
postgres/       init.sql (GENERATED), migrations/, seed data, seed/
nginx/          nginx.conf + karmyq.com vhosts + ssl.conf
observability/  grafana/, prometheus/, loki/
scripts/        server-side ops: backup-db, rollback, setup-server, renew_certs, setup_nginx
```

---

## ⚠️ `init.sql` is GENERATED — never hand-edit it

Its own header says so. The source of truth is the **migration chain**:

```
infrastructure/postgres/migrations/*.sql  ->  scripts/regenerate-init-sql.sh  ->  init.sql
```

65 migrations currently. Curated demo data lives separately in `postgres/seed-data.sql` and is
spliced into the artifact during regeneration. The generated schema deliberately carries **no
object ownership and no ACLs** — Postgres's docker-entrypoint runs it as `POSTGRES_USER`, which
therefore owns everything.

**To change the schema:** add a migration, run `scripts/regenerate-init-sql.sh`, commit both.
`tests/regression/sprint-120-init-sql-drift-gate.test.ts` asserts the two stay in sync, so editing
`init.sql` directly fails CI *and* gets overwritten on the next regeneration.

New migrations: guard with `IF NOT EXISTS`, respect schema ownership, and dry-run any data repair
before it touches real rows. The `migration-validator` agent reviews these before commit.

---

## Database schemas — there are 13, not 6

| Schema | Tables | Owner service |
|---|---|---|
| `auth` | 14 | Auth (3001) |
| `communities` | 20 | Community (3002) |
| `requests` | 18 | Request (3003) |
| `reputation` | 13 | Reputation (3004) |
| `notifications` | 3 | Notification (3005) |
| `messaging` | 3 | Messaging (3006) |
| `social_graph` | 5 | Social-Graph (3010) |
| `feed` | 3 | Request (feed folded in — ADR-071) |
| `federation` | 12 | cross-community federation |
| `governance` | 4 | community governance |
| `feedback` | 2 | interaction feedback |
| `provider` | 1 | provider profiles |
| `events` | 1 | event log |

**The schema is `communities`, plural — not `community`.** There is not one `community.` reference
in `init.sql`. Same trap family as the JWT `communities` field: the singular guess parses fine and
then finds nothing.

Two more renames that bite, because the obvious name is the wrong one:

| You'll guess | It's actually |
|---|---|
| `communities.memberships` | **`communities.members`** |
| `requests.offers` | **`requests.help_offers`** |

Core tables: `auth.users`, `auth.sessions`, `auth.refresh_tokens` · `communities.communities`,
`communities.members`, `communities.settings`, `communities.norms` · `requests.help_requests`,
`requests.help_offers`, `requests.matches`, `requests.dibs`, `requests.feed_events` ·
`reputation.karma_records`, `reputation.trust_scores`, `reputation.badges` ·
`social_graph.trust_edges`, `social_graph.connections`, `social_graph.interaction_weights` ·
`messaging.conversations`, `messaging.messages`.

**RLS is on** — 26 policies. Tenant isolation is enforced in the database, so a query that
bypasses `dbContextMiddleware` (`setDbContext`) will silently see nothing rather than error.

---

## Docker

```bash
cd infrastructure/docker

docker-compose up -d                      # full stack
docker-compose up -d postgres redis       # just the deps — what tests need
docker-compose up -d --build auth-service # rebuild one service
docker-compose logs -f auth-service
docker-compose down -v                    # ⚠️ destroys volumes; next up re-runs init.sql
```

Compose files are environment-specific: `docker-compose.yml` (dev), `.test.yml` (isolated test DB),
`.qa.yml`, `.staging.yml`, `.prod.yml`, `.observability.yml`. Images are `node:24-alpine`, gate-locked
to one major by [ADR-090](../docs/adr/ADR-090-container-runtime-floor.md) — a new service copied from
an old template with `node:18-alpine` fails that gate.

## nginx routing

A new service needs a `location ~ ^/api/{prefix}(/.*)?$` block in `nginx.conf`, and `proxy_pass`
**must strip `/api`**:

```nginx
proxy_pass http://your_service/{prefix}$1$is_args$args;
```

Changes take effect on the **next deploy** — or manually on the server: `sudo cp` + `nginx -t` +
reload. Note `/health` is not exposed through nginx; probe an `/api/...` route instead.

## Observability

`grafana/provisioning/` — `datasources/datasources.yml` plus four provisioned dashboards
(`service-overview`, `infrastructure`, `error-visibility`, `simulation-overview`) ·
`prometheus/prometheus.yml` (scrape config) · `loki/` (`loki-config.yml`, `promtail-config.yml`).
Brought up by `docker-compose.observability.yml`.

## Server ops (`infrastructure/scripts/`)

`backup-db.sh`, `rollback.sh`, `setup-server.sh`, `setup_nginx.sh`, `setup_prod.sh`,
`setup_env.sh`, `renew_certs.sh`. **Demo-server data operations use the DB user `karmyq_prod`.**
