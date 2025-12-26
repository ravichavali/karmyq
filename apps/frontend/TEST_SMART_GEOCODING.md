# Testing Smart Geocoding Feature

## Prerequisites

✅ Frontend running on http://localhost:3000
✅ Backend services running (docker-compose)
✅ User logged in and has community access

## Test Scenarios

### Test 1: Smart Detection with "from" Keyword

**Steps:**
1. Go to http://localhost:3000/dashboard
2. Select **"Ride"** request type
3. In the textarea, start typing: `"Need a ride from San"`

**Expected Behavior:**
- After typing "San" (2 characters), autocomplete should appear
- Should show "Searching..." initially
- Then show real addresses:
  - 📍 San Francisco, California, USA
  - 📍 San Jose, California, USA
  - 📍 San Diego, California, USA
  - 🏙️ SFO - San Francisco International Airport

**To Select:**
- Press `↓` arrow to navigate
- Press `Tab` or `Enter` to select
- OR click with mouse

**Expected Result:**
```
Textarea: "Need a ride from San Francisco "
Extracted Data Chip: 📍 San Francisco (with coordinates)
```

**Verify in Browser Console:**
```javascript
// Should show coordinates
{ text: "San Francisco", type: "origin", lat: 37.7749, lng: -122.4194 }
```

---

### Test 2: Smart Detection with "to" Keyword

**Steps:**
1. Continue from Test 1
2. Type: `"to Oak"`

**Expected Behavior:**
- After typing "Oak" (3 characters), autocomplete should appear
- Should show:
  - 📍 Oakland, California, USA
  - 📍 OAK - Oakland International Airport

**Expected Result:**
```
Textarea: "Need a ride from San Francisco to Oakland "
Extracted Data Chips:
  📍 San Francisco (origin)
  📍 Oakland (destination)
```

---

### Test 3: Explicit @ Trigger (Should Still Work)

**Steps:**
1. Clear textarea
2. Type: `"Need a ride @San"`

**Expected Behavior:**
- Autocomplete appears after typing `@`
- Shows same geocoded suggestions
- Time suggestions also shown (tomorrow, today, etc.)

**Expected Result:**
```
Textarea: "Need a ride @San Francisco "
```

---

### Test 4: Complete Ride Request with All Shortcuts

**Steps:**
1. Clear textarea
2. Type: `"Need a ride from San"`
3. Select "San Francisco"
4. Type: ` to Oak`
5. Select "Oakland"
6. Type: ` @tomorrow 3:30PM #2 !urgent $20-50`

**Expected Final Text:**
```
Need a ride from San Francisco to Oakland tomorrow 3:30PM 2 people urgent $20-50
```

**Expected Extracted Data:**
- 📍 San Francisco (origin) - lat: 37.7749, lng: -122.4194
- 📍 Oakland (destination) - lat: 37.8044, lng: -122.2712
- 📅 tomorrow
- 📅 3:30PM
- 👥 2 people
- ⚡ urgent
- 💰 $20-50

**Verify Payload (Browser Console):**
```javascript
{
  origin: {
    address: "San Francisco",
    lat: 37.7749,
    lng: -122.4194
  },
  destination: {
    address: "Oakland",
    lat: 37.8044,
    lng: -122.2712
  },
  seats_needed: 1,
  departure_time: "2025-12-27T23:30:00.000Z"
}
```

---

### Test 5: Airport Codes (2-Character Support)

**Steps:**
1. Type: `"from SJ"`

**Expected Behavior:**
- Autocomplete should appear after 2 characters
- Should show San Jose results

**Steps:**
2. Type: `"from SF"`

**Expected Behavior:**
- Should show San Francisco results

---

### Test 6: Caching (Performance Test)

**Steps:**
1. Type: `"from San"` and select "San Francisco"
2. Clear textarea
3. Type: `"from San"` again

**Expected Behavior:**
- Second time should be MUCH faster (~5ms vs ~500ms)
- No network request (check Network tab in DevTools)
- Results from cache

**Verify in Console:**
```
Cache hit for geocoding: san
```

---

### Test 7: Non-Ride Request Types (Should NOT Trigger)

**Steps:**
1. Select **"Service"** request type
2. Type: `"from home"`

**Expected Behavior:**
- NO autocomplete should appear
- Smart detection only works for ride requests

**To Use Geocoding:**
- Must use explicit `@` trigger: `"@home"`

---

## Debugging

### Autocomplete Not Appearing?

**Check 1: Request Type**
- Make sure you selected "Ride" request type
- Smart detection only works for rides

**Check 2: Minimum Characters**
- Type at least 2 characters after "from" or "to"
- Example: "from Sa" ✅
- Example: "from S" ❌

**Check 3: Pattern Matching**
- Pattern: `from San` (space after "from")
- Pattern: `to Oak` (space after "to")
- Must be at cursor position

**Check 4: Browser Console**
```javascript
// Should see:
"Searching for: San"
"Geocoding API called for: San"
"Cache hit for geocoding: san" (on subsequent searches)
```

### Coordinates Not Stored?

**Open React DevTools:**
1. Find `Dashboard` component
2. Check `parsedRequest` state
3. Look for `extractedData.locations`
4. Each location should have `lat` and `lng`

**Example:**
```javascript
parsedRequest: {
  extractedData: {
    locations: [
      { text: "San Francisco", type: "origin", lat: 37.7749, lng: -122.4194 }
    ]
  }
}
```

### Network Errors?

**Check Browser Console for:**
- `Geocoding API error: 429 Too Many Requests` → Rate limited, wait 1 second
- `Geocoding request timed out` → Network slow, try again
- `Invalid characters in search query` → Input sanitization triggered

**Check Network Tab:**
- Look for requests to `nominatim.openstreetmap.org`
- Should be 1 request per second max
- Should return JSON with results

---

## Performance Benchmarks

### Expected Timings

| Scenario | Expected Time |
|----------|--------------|
| First geocode | ~500ms (API call) |
| Cached geocode | ~5ms (from cache) |
| Debounce delay | 500ms |
| Rate limit wait | 0-1000ms |

### Cache Hit Rate

**After typing "from San" 5 times:**
- API calls: 1
- Cache hits: 4
- Hit rate: 80%

**Check in Console:**
```javascript
import { cache } from '@/lib/cache'

// View all cached geocoding results
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i)
  if (key?.startsWith('cache:geocode:')) {
    console.log(key, localStorage.getItem(key))
  }
}
```

---

## Common Issues

### Issue: "Keep typing..." appears but never shows results

**Cause:** Query less than 2 characters
**Solution:** Type at least 2 characters

### Issue: Autocomplete disappears immediately

**Cause:** Focus lost from textarea
**Solution:** Click back in textarea and try again

### Issue: Wrong location selected

**Cause:** Multiple locations with same name
**Solution:** Select more specific result with full address

### Issue: Coordinates are (0, 0)

**Cause:** Geocoding failed or returned no results
**Solution:** Try more specific address (e.g., "San Francisco, CA" instead of "San")

---

## Success Criteria

✅ Autocomplete appears after typing 2+ characters after "from" or "to"
✅ Real addresses from OpenStreetMap shown in suggestions
✅ Tab/Enter selects address
✅ Natural language preserved ("from San Francisco" not "from @San Francisco")
✅ Coordinates stored in parsedRequest state
✅ Payload built with real lat/lng
✅ Caching works (second search is instant)
✅ Explicit @ trigger still works
✅ Other request types don't trigger smart detection

---

## Next Steps

After confirming geocoding works:

1. **Test E2E Flow**
   - Create complete request
   - Submit to backend
   - Verify payload includes coordinates

2. **Test on Mobile**
   - Smaller screen layout
   - Touch selection
   - Virtual keyboard behavior

3. **Load Testing**
   - Rapid typing
   - Multiple consecutive searches
   - Rate limiting enforcement

4. **Edge Cases**
   - Very long addresses
   - Special characters
   - International addresses
   - No results found
