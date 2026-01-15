# Production Issues Tracker

**Last Updated**: 2026-01-01
**Environment**: https://karmyq.com (OCI Production)

## Critical Issues (Blocking User Experience)

### 1. Frontend API Client - Wrong URL Paths ⚠️ HIGH PRIORITY

**Status**: Not Fixed
**Impact**: Dashboard cannot load data, 500/404 errors everywhere

**Problem**: Frontend API client is doubling path segments:
```
❌ /api/communities/communities → should be /api/communities
❌ /api/notifications/notifications/{id} → should be /api/notifications/{id}
❌ /api/requests/requests → should be /api/requests
```

**Root Cause**: Frontend API client configuration issue

**Fix Required**: Update frontend API client base URLs
- File: `apps/frontend/lib/api.ts` or similar
- Change base URL from `/api/communities/communities` to `/api/communities`

**Test**:
```bash
# These should work:
curl https://karmyq.com/api/communities
curl https://karmyq.com/api/requests
curl https://karmyq.com/api/notifications/{user_id}
```

---

### 2. Request Service - 500 Errors ⚠️ HIGH PRIORITY

**Status**: Partially Fixed (code updated, needs deployment verification)
**Impact**: Cannot view requests or matches

**Errors**:
```
GET /api/requests/requests?requester_id=... - 500
GET /api/requests/matches?limit=100 - 500
```

**Likely Cause**:
- UUID parsing error (`string_to_uuid`)
- Query parameter being passed incorrectly

**Fix Required**: Check request-service logs on production
```bash
docker logs karmyq-request-service --tail=100 | grep "500\|error"
```

**Action**: Verify the latest code fix is deployed and working

---

### 3. Messaging Service - 502 Bad Gateway 🔴 CRITICAL

**Status**: Not Investigated
**Impact**: Cannot view conversations

**Error**:
```
GET /api/messages/conversations - 502
```

**Possible Causes**:
1. Messaging service not running
2. Nginx not routing to messaging service
3. Messaging service crashed

**Debug**:
```bash
docker ps | grep messaging
docker logs karmyq-messaging-service --tail=50
curl http://localhost:3006/health
```

---

## Medium Priority Issues

### 4. Notification Service - 404 Errors

**Status**: Not Fixed
**Impact**: No notifications shown

**Errors**:
```
GET /api/notifications/notifications/{id} - 404
GET /api/notifications/notifications/{id}/unread-count - 404
```

**Cause**: Wrong URL (doubling "notifications")
**Fix**: Frontend API client issue (see #1)

---

### 5. SSE/WebSocket - Not Configured

**Status**: Expected (not configured in nginx)
**Impact**: No real-time updates

**Errors**:
```
WebSocket connection to 'wss://karmyq.com/socket.io/?EIO=4&transport=websocket' failed
GET /api/notifications/notifications/stream/{id} - 401
```

**Fix Required**: Add WebSocket proxy to nginx
```nginx
location /socket.io/ {
    proxy_pass http://notification_service;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

---

## Low Priority Issues

### 6. Rate Limiting During Seeding

**Status**: ✅ FIXED (retry logic added)
**Impact**: Seeding takes 15-20 min but completes
**Solution**: Automatic retry with exponential backoff

---

## Process Improvements Needed

### Development Workflow Issues

1. **Two-stream development not working well**
   - Database changes + code changes getting out of sync
   - Need better migration management
   - Consider: schema-first approach

2. **chmod +x repetition**
   - ✅ FIXED: Created git hook setup script
   - Run once: `./scripts/setup-production-hooks.sh`

3. **Multi-user/AI coordination**
   - Need: Clear task assignment system
   - Need: Conflict detection
   - Need: Better branching strategy

---

## Action Plan (Immediate)

### Step 1: Fix Frontend API Client (30 min)
1. Find frontend API client configuration
2. Fix doubled path segments
3. Test all endpoints
4. Rebuild and deploy frontend

### Step 2: Verify Backend Services (15 min)
1. Check messaging service status
2. Verify request service logs
3. Test all backend endpoints directly

### Step 3: Seed Production Data (20 min)
1. Run seeding with retry logic
2. Monitor progress
3. Verify data created

### Step 4: Configure WebSockets (30 min)
1. Update nginx config for SSE/WebSocket
2. Test real-time notifications
3. Reload nginx

---

## Testing Checklist

After fixes, test these user flows:

- [ ] Login
- [ ] View dashboard (should show stats)
- [ ] Browse communities
- [ ] View requests
- [ ] Create request
- [ ] View notifications
- [ ] View messages
- [ ] Real-time updates work

---

## Next Session Tasks

1. Fix frontend API client URLs
2. Investigate messaging service 502
3. Complete production seeding
4. Configure WebSockets
5. Document improved multi-AI workflow

