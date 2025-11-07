# Log Level Configuration

Guide to configuring log levels across all Karmyq services.

## Available Log Levels

| Level | Use Case | Example |
|-------|----------|---------|
| `debug` | Detailed debugging information, database queries | "Cache lookup for key user:123" |
| `info` | Important application events | "User logged in", "Service started" |
| `warn` | Warning conditions, potential issues | "High memory usage", "Rate limit approaching" |
| `error` | Error conditions requiring attention | "Database connection failed", "API call failed" |

## Setting Log Level

### Environment Variable

Set the `LOG_LEVEL` environment variable:

```bash
# Development - see everything
LOG_LEVEL=debug npm run dev

# Production - only important events
LOG_LEVEL=info npm start

# Production (minimal) - only warnings and errors
LOG_LEVEL=warn npm start

# Critical only
LOG_LEVEL=error npm start
```

### Docker Compose

Update `infrastructure/docker/docker-compose.yml`:

```yaml
auth-service:
  environment:
    LOG_LEVEL: info  # or debug, warn, error
```

### .env File

Add to your `.env` file:

```bash
LOG_LEVEL=info
```

## Log Level Hierarchy

When you set a log level, you'll see that level and all levels above it:

```
debug → Shows: debug, info, warn, error (everything)
info  → Shows: info, warn, error
warn  → Shows: warn, error
error → Shows: error only
```

## Recommended Settings

### Development
```bash
LOG_LEVEL=debug
NODE_ENV=development
```
- See all logs including database queries
- Pretty-printed output with emojis
- Full stack traces

### Staging
```bash
LOG_LEVEL=info
NODE_ENV=production
```
- Important events and errors
- JSON formatted logs
- Performance metrics

### Production
```bash
LOG_LEVEL=warn
NODE_ENV=production
```
- Warnings and errors only
- Reduced log volume
- Focus on issues

## Per-Service Configuration

You can set different log levels for different services:

```yaml
# docker-compose.yml
auth-service:
  environment:
    LOG_LEVEL: debug  # Verbose logging for auth

community-service:
  environment:
    LOG_LEVEL: info   # Normal logging

request-service:
  environment:
    LOG_LEVEL: warn   # Only warnings/errors
```

## Filtering Logs in Grafana

Even with higher log levels, you can filter in Grafana:

### Show only errors
```logql
{service="auth-service"} |= "error"
```

### Show debug logs
```logql
{service="auth-service"} |= "debug"
```

### Show specific operations
```logql
{service="auth-service"} |= "user_login"
```

## Performance Considerations

### Log Level Impact

| Level | Volume | Performance Impact | Use Case |
|-------|--------|-------------------|----------|
| debug | Very High | ~10-15% overhead | Development only |
| info | High | ~5% overhead | Development, Staging |
| warn | Low | ~1% overhead | Production |
| error | Very Low | <1% overhead | Critical systems |

### Tips for Production

1. **Start with `warn`** - Captures issues without too much noise
2. **Monitor log volume** - High volumes can fill disk space
3. **Use log rotation** - Automatically clean up old logs
4. **Sample debug logs** - Only log 1% of debug messages if needed

## Temporary Debug Mode

Enable debug logging temporarily without restart:

### Using Environment Variable Override

```bash
# Start with info level
docker-compose up

# In another terminal, update specific service
docker-compose exec auth-service sh -c 'export LOG_LEVEL=debug && kill -HUP 1'
```

### Best Practice

Create a debug endpoint (disabled in production):

```typescript
if (process.env.NODE_ENV === 'development') {
  app.post('/debug/loglevel', (req: any, res) => {
    const { level } = req.body;
    process.env.LOG_LEVEL = level;
    res.json({ success: true, level });
  });
}
```

## Troubleshooting

### Too Many Logs

**Problem**: Log volume too high, hard to find issues

**Solution**:
```bash
# Increase log level
LOG_LEVEL=warn

# Or filter in Grafana
{service=~".*"} |~ "error|ERROR"
```

### Missing Important Logs

**Problem**: Can't find debugging information

**Solution**:
```bash
# Lower log level temporarily
LOG_LEVEL=debug

# Then increase back when done
LOG_LEVEL=info
```

### Logs Not Appearing

**Problem**: Setting LOG_LEVEL but no change

**Solutions**:
1. Check environment variable is set:
   ```bash
   docker exec karmyq-auth-service env | grep LOG_LEVEL
   ```

2. Restart service after changing:
   ```bash
   docker-compose restart auth-service
   ```

3. Check logger is using the env var:
   ```typescript
   console.log('Current LOG_LEVEL:', process.env.LOG_LEVEL);
   ```

## Examples

### Development Session
```bash
# Start with debug to see everything
LOG_LEVEL=debug docker-compose up

# View logs in Grafana
# Filter for specific user: {service="auth-service"} | json | userId="123"
```

### Production Deploy
```bash
# Set production log level
export LOG_LEVEL=warn
export NODE_ENV=production

# Deploy
docker-compose up -d

# Monitor for errors only
docker logs -f karmyq-auth-service | grep ERROR
```

### Debugging Production Issue
```bash
# Temporarily enable debug for one service
docker-compose exec auth-service sh -c 'export LOG_LEVEL=debug'

# Reproduce issue
# ...

# Reset to warn
docker-compose exec auth-service sh -c 'export LOG_LEVEL=warn'
```

## Log Level in Code

You can also check log level in your code:

```typescript
if (process.env.LOG_LEVEL === 'debug') {
  // Expensive debug operation
  const debugInfo = computeExpensiveDebugInfo();
  logger.debug('Detailed info', debugInfo);
}
```

## Summary

- **Default**: `info` - Good balance for most environments
- **Development**: `debug` - See everything
- **Production**: `warn` - Only important issues
- **Critical Systems**: `error` - Minimal logging

Change anytime with `LOG_LEVEL` environment variable!
