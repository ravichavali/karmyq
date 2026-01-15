# Accessing Grafana/Loki for Debugging

## SSH Tunnel Access (Secure)

From your local machine:

```bash
ssh -L 3011:localhost:3011 ubuntu@karmyq.com
```

Then open: **http://localhost:3011**

Login credentials: `admin` / Your Grafana password

## Viewing Service Logs in Loki

Once logged in to Grafana:

1. Click **Explore** (compass icon on left sidebar)
2. Select **Loki** as the data source (dropdown at top)
3. Use LogQL queries to filter logs:

### Common Queries

**View all request service logs:**
```
{container_name="karmyq-request-service"}
```

**View auth service errors only:**
```
{container_name="karmyq-auth-service"} |= "error"
```

**View all POST requests:**
```
{container_name="karmyq-request-service"} |= "POST"
```

**View logs from last 5 minutes:**
```
{container_name="karmyq-request-service"} |= "POST" [5m]
```

**Search across all services:**
```
{job="docker"} |= "your search term"
```

### Available Containers

- `karmyq-auth-service` - Authentication, user management
- `karmyq-community-service` - Community management
- `karmyq-request-service` - Help requests, matches, offers
- `karmyq-reputation-service` - Karma, trust scores
- `karmyq-notification-service` - Notifications
- `karmyq-messaging-service` - Chat, conversations
- `karmyq-feed-service` - Personalized feed
- `karmyq-cleanup-service` - Data expiration
- `karmyq-geocoding-service` - Location search
- `karmyq-frontend` - Next.js frontend
- `karmyq-postgres` - Database logs
- `karmyq-redis` - Cache logs

## Debugging Request Creation Issue

To debug why request creation isn't working:

1. Open Grafana (http://localhost:3011 via SSH tunnel)
2. Go to **Explore** → **Loki**
3. Query: `{container_name="karmyq-request-service"} |= "POST"`
4. Set time range to "Last 15 minutes"
5. Try creating a request from the frontend
6. Watch Loki for incoming POST requests

If no POST request appears:
- Issue is in frontend (axios call not firing)
- Check browser Network tab for blocked requests
- Check browser console for JavaScript errors

If POST request appears but fails:
- Check the error message in Loki
- Common issues: auth, validation, database

## Retention

- Logs are retained for **7 days** (168 hours)
- Older logs are automatically cleaned up by compactor

## Useful Features

- **Live tail**: Click "Live" button to stream logs in real-time
- **Context**: Click any log line to see surrounding context
- **Labels**: Filter by container, level, job, etc.
- **Regex**: Use `|~ "regex pattern"` for pattern matching
- **Line filtering**: Use `|=` for contains, `!=` for not contains

## Performance Tip

If queries are slow, narrow your time range:
- Last 15 minutes (default): Fast
- Last 1 hour: Moderate
- Last 24 hours: Slower
- Last 7 days: Very slow

Always use specific container filters when possible.
