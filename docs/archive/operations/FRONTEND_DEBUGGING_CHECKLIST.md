# Frontend Debugging Checklist

## When Users Get Logged Out / Redirected to Login

### Step 1: Check Browser Console (DO THIS FIRST!)
**Time: 30 seconds**

Open browser console (F12) and look for:
- ❌ Red errors (especially 401, 403, 500)
- ⚠️ Yellow warnings about authentication
- 🔍 Any API calls failing

**What to look for:**
```
✓ Good: No errors, just normal logs
✗ Bad: "401 Unauthorized" on any endpoint
✗ Bad: "Network request failed"
✗ Bad: "TypeError: Cannot read property..."
```

### Step 2: Check Network Tab
**Time: 1 minute**

1. Open DevTools → Network tab
2. Reproduce the issue
3. Look for red/failed requests
4. Check the **status code** and **response** of each API call

**Common issues:**
- 401 → Check which endpoint returned it (may be optional feature)
- 500 → Backend error, check server logs
- 502/504 → Service is down or not responding
- CORS error → nginx/backend configuration issue

### Step 3: Capture HAR File
**Time: 1 minute**

If issue is intermittent or complex:
1. Network tab → Right-click → "Save all as HAR"
2. Review the HAR file to see the exact sequence of requests
3. Look for the request that happens RIGHT BEFORE the redirect

### Step 4: Check Logout Trigger Points
**Time: 2 minutes**

Search codebase for where logout happens:
```bash
# Find where logout/redirect is triggered
grep -r "router.push('/login')" apps/frontend/src/
grep -r "window.location.href = '/login'" apps/frontend/src/
grep -r "localStorage.removeItem('token')" apps/frontend/src/
```

**Common locations:**
- `apps/frontend/src/lib/api.ts` - Axios error interceptor
- Page-level `useEffect` - Token validation
- Protected route components

### Step 5: Check Axios Interceptors
**Time: 1 minute**

File: `apps/frontend/src/lib/api.ts`

Look for:
```typescript
const errorInterceptor = (error: any) => {
  if (error.response?.status === 401) {
    // THIS IS WHERE LOGOUT HAPPENS
    localStorage.removeItem('token')
    window.location.href = '/login'
  }
}
```

**Questions to ask:**
- Is it logging out on ALL 401s or specific ones?
- Should optional features trigger logout?
- Is there a whitelist of endpoints that shouldn't trigger logout?

### Step 6: Check Token in LocalStorage
**Time: 30 seconds**

In browser console:
```javascript
localStorage.getItem('token')
localStorage.getItem('user')
```

**What to look for:**
- `null` → Token was cleared (logout happened)
- `"eyJ..."` → Token exists, but may be invalid/expired
- Check token expiration with: `JSON.parse(atob(token.split('.')[1]))`

### Step 7: Only THEN Consider Cache Issues
**Time: Variable**

If all above checks pass, THEN consider browser cache:
- Hard refresh (Ctrl+Shift+R)
- Clear cache (Ctrl+Shift+Delete)
- Check if-none-match / if-modified-since headers
- Check what JavaScript files are being loaded

## Debugging Decision Tree

```
User gets logged out
    ↓
Open Console - Any errors?
    ↓ YES
    ├─ 401 Error?
    │   ↓ YES
    │   └─ Which endpoint?
    │       ├─ Optional feature → Add to interceptor whitelist
    │       └─ Critical endpoint → Check backend auth
    │
    ├─ 500 Error?
    │   └─ Check backend service logs
    │
    └─ JavaScript error?
        └─ Check for missing dependencies / API changes
    ↓ NO
    └─ Check Network tab for failed requests
        ↓ NO ERRORS
        └─ Check if token exists in localStorage
            ↓ TOKEN EXISTS
            └─ Check token expiration
                ↓ TOKEN VALID
                └─ NOW check browser cache
```

## Common Mistakes to Avoid

### ❌ DON'T Assume Browser Cache First
- Cache issues are RARE compared to logic bugs
- Cache issues don't cause "flashing" redirects
- Cache issues don't trigger on first load

### ❌ DON'T Guess Without Data
- Always check console/network tab FIRST
- Don't try random fixes without understanding the problem
- Capture HAR file if you can't reproduce locally

### ❌ DON'T Make Multiple Changes at Once
- Fix one thing at a time
- Test after each change
- Document what fixed it

### ❌ DON'T Skip Systematic Debugging
```
Bad:  "Let's try disabling cache" → "Let's rebuild" → "Let's restart services"
Good: "Check console" → "Found 401 error" → "Check interceptor" → "Fix interceptor"
```

## Example: The Karma Feature Case Study

### What Happened
- User reported: "Profile page logs me out"
- Symptom: Page flashes briefly then redirects to login

### What We Did Wrong
1. Assumed browser cache (spent 2+ hours)
2. Tried cache-busting techniques
3. Rebuilt frontend multiple times
4. Checked nginx routing
5. Verified backend endpoints

### What We Should Have Done
1. ✅ Check console → Would have seen `401 from /api/invitations`
2. ✅ Check error interceptor → Would have found logout logic
3. ✅ Fix in 5 minutes → Add `/invitations` to optional endpoints whitelist

### The Fix
```typescript
const optionalEndpoints = [
  '/invitations',      // Don't logout if invitation chain fails
  '/me/settings',      // Don't logout if privacy settings fail
  '/me/karma',         // Don't logout if karma fails
]

if (error.response?.status === 401) {
  const isOptionalEndpoint = optionalEndpoints.some(e => url.includes(e))
  if (!isOptionalEndpoint) {
    // Only logout for critical auth failures
    window.location.href = '/login'
  }
}
```

### Time Spent
- ❌ Wrong approach: ~3 hours
- ✅ Right approach: ~5 minutes

### Lesson
**Always check console/network tab first. Browser cache is rarely the problem.**

## Quick Reference Commands

### Check Frontend Logs
```bash
# Production
ssh ubuntu@karmyq.com "docker logs karmyq-frontend --tail 50"

# Check which JS files are being served
curl -I https://karmyq.com/_next/static/chunks/pages/profile-*.js
```

### Check Backend Logs
```bash
# All services
ssh ubuntu@karmyq.com "docker logs karmyq-auth-service --tail 50"
ssh ubuntu@karmyq.com "docker logs karmyq-community-service --tail 50"

# Filter for errors
docker logs karmyq-auth-service --tail 100 | grep -E '(error|Error|401|500)'
```

### Debug in Browser Console
```javascript
// Check token
localStorage.getItem('token')

// Decode token (see expiration)
JSON.parse(atob(localStorage.getItem('token').split('.')[1]))

// Check what's loaded
performance.getEntriesByType('resource').filter(e => e.name.includes('profile'))

// Test API call manually
fetch('/api/users/me/settings', {
  headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
}).then(r => r.json()).then(console.log)
```

## When to Escalate

If after following this checklist you still can't find the issue:
1. Capture HAR file
2. Check backend service logs
3. Enable verbose logging in frontend
4. Consider it may be a backend issue, not frontend

## Prevention

### Code Review Checklist
- [ ] Does error handler distinguish between critical and optional failures?
- [ ] Are 401 errors from optional features handled gracefully?
- [ ] Is there logging to help debug issues?
- [ ] Are error messages user-friendly?

### Testing Checklist
- [ ] Test with browser console open
- [ ] Test with network tab recording
- [ ] Test with cache disabled
- [ ] Test with various user states (no communities, no invitations, etc.)
