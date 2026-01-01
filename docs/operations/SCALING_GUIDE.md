# Scaling Guide

## Vertical Scaling (Bigger Server)
The easiest way to scale is to upgrade the OCI instance size (e.g., more CPU/RAM).
Docker Compose will automatically use available resources up to the limits defined in `docker-compose.prod.yml`.

## Horizontal Scaling (More Instances)
To handle more traffic, you can run multiple instances of stateless services.

**Command**:
```bash
docker compose -f infrastructure/docker/docker-compose.yml -f infrastructure/docker/docker-compose.prod.yml up -d --scale request-service=2 --scale community-service=2
```

### Services that CAN scale horizontally:
-   `auth-service`
-   `community-service`
-   `request-service`
-   `reputation-service`
-   `feed-service`
-   `messaging-service` (Now supported via Redis)
-   `notification-service` (Requires sticky sessions - configured in Nginx)

### Services that should remain SINGLETON (for now):
-   `cleanup-service` (Cron jobs might duplicate)
-   `geocoding-service` (Caching layer, multiple instances OK but might be redundant)
-   `social-graph-service` (if it maintains in-memory graph cache)

## Database Scaling
1.  **Read Replicas**: Configure PostgreSQL read replicas and update `db.ts` to use a read-only connection string for SELECT queries.
2.  **Connection Pooling**: We use `pg-pool` with `max: 5` per service. With 9 services * 2 instances = 18 * 5 = 90 connections. Default Postgres limit is 100.
    -   *Action*: If scaling beyond 2 instances per service, use **PgBouncer** in front of Postgres.

## Redis Scaling
-   Current setup uses a single Redis instance.
-   For high availability, use Redis Sentinel or a managed Redis cluster (OCI Redis).
