# Browser Debugging Guide

## Open Browser Console

1. Go to http://localhost:3000/dashboard
2. Press F12 to open DevTools
3. Go to Console tab

## Test 1: Check if geocoding module loads

Paste this in console:

```javascript
// Import the geocoding function
import('./src/lib/geocoding.ts').then(module => {
  console.log('✅ Geocoding module loaded:', module)
  window.geocoding = module
})
```

## Test 2: Test geocoding directly

```javascript
// Test the searchAddresses function directly
const { searchAddresses } = await import('./src/lib/geocoding.ts')

console.log('Testing geocoding for "San"...')
const results = await searchAddresses('San')
console.log('Results:', results)
```

Expected output:
```javascript
[
  {
    display_name: "San Francisco, California, USA",
    address: "San Francisco",
    lat: 37.7749,
    lng: -122.4194,
    type: "city"
  },
  // ... more results
]
```

## Test 3: Check cache

```javascript
// Check if caching works
const { cache } = await import('./src/lib/cache.ts')

// View cache
console.log('Checking cache...')
const cached = await cache.get('geocode:san')
console.log('Cached data:', cached)
```

## Test 4: Monitor state changes

While typing in the textarea, watch for these console messages:

```
🔍 Smart detection: ...
📍 Location text detected: ...
🔧 EnhancedAutocomplete useEffect: ...
✅ Triggering geocoding search for: ...
🌐 Calling searchAddresses API...
📦 Geocoding results: ...
```

If you DON'T see these messages:
- Smart detection is not triggering
- Check if requestType is "ride"
- Check if pattern matches (must have "from " or "to ")

## Test 5: Check network requests

1. Go to Network tab in DevTools
2. Type "from San" in textarea
3. Look for requests to `nominatim.openstreetmap.org`

Expected:
- URL: `https://nominatim.openstreetmap.org/search?q=San&format=json&limit=5&addressdetails=1`
- Status: 200
- Response: JSON array with locations

If NO network request:
- Check if cache has the data (Test 3)
- Check console for errors

## Test 6: React DevTools

Install React DevTools extension, then:

1. Open React DevTools
2. Find `Dashboard` component
3. Check state:
   - `autocompleteSuggestions` - Should have data when typing
   - `autocompleteTrigger` - Should be "@"
   - `searchQuery` - Should be the location text
   - `parsedRequest` - Should have locations with lat/lng

## Common Issues

### Issue: Nothing happens when typing "from San"

**Check 1: Is requestType "ride"?**
```javascript
// In console, inspect the component state
$r.state.requestType // Should be "ride"
```

**Check 2: Is the pattern matching?**
```javascript
const text = "Need a ride from San"
const match = text.match(/from\s+([a-zA-Z0-9\s\-]*)$/i)
console.log('Match:', match)
// Should output: ["from San", "San"]
```

**Check 3: Is the onChange handler firing?**
Add this temporarily to dashboard.tsx:
```typescript
onChange={(e) => {
  console.log('📝 onChange fired:', e.target.value)
  handleDescriptionChange(e.target.value, e.target.selectionStart)
}}
```

### Issue: Autocomplete doesn't show

**Check if suggestions array has data:**
```javascript
// In React DevTools, Dashboard component
state.autocompleteSuggestions
// Should be: [{ value: '@loading', label: 'Searching...', ... }]
```

**Check if EnhancedAutocomplete is rendered:**
```javascript
// In Elements tab, search for "enhanced-autocomplete" or look for the div
```

### Issue: API returns empty results

**Test the API directly in console:**
```javascript
const response = await fetch(
  'https://nominatim.openstreetmap.org/search?q=San&format=json&limit=5',
  {
    headers: {
      'User-Agent': 'Karmyq/1.0 (mutual aid platform; https://karmyq.com)'
    }
  }
)
const data = await response.json()
console.log('API response:', data)
```

If empty:
- Try more specific query: "San Francisco"
- Check if rate limited (should wait 1 second between requests)

### Issue: Cache errors

**Clear the cache:**
```javascript
const { cache } = await import('./src/lib/cache.ts')
await cache.clear()
console.log('✅ Cache cleared')
```

**Check IndexedDB:**
1. Go to Application tab
2. Expand IndexedDB
3. Look for `karmyq-cache`
4. Check `geocoding` store

**Check localStorage:**
```javascript
// View all cache entries
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i)
  if (key?.startsWith('cache:geocode:')) {
    console.log(key, localStorage.getItem(key))
  }
}
```

## Full End-to-End Test

```javascript
// 1. Import modules
const { searchAddresses } = await import('./src/lib/geocoding.ts')
const { parseRequestDescription } = await import('./src/lib/requestParser.ts')

// 2. Test parsing
const text = "Need a ride from San Francisco to Oakland"
const parsed = parseRequestDescription(text, 'ride')
console.log('Parsed:', parsed)

// 3. Test geocoding
const sfResults = await searchAddresses('San Francisco')
console.log('SF:', sfResults[0])

const oakResults = await searchAddresses('Oakland')
console.log('Oakland:', oakResults[0])

// 4. Check if coordinates would be stored
console.log('SF coords:', sfResults[0].lat, sfResults[0].lng)
console.log('Oakland coords:', oakResults[0].lat, oakResults[0].lng)
```

Expected output:
```
Parsed: {
  extractedData: {
    locations: [
      { text: "San Francisco", type: "origin" },
      { text: "Oakland", type: "destination" }
    ]
  }
}

SF: {
  address: "San Francisco",
  lat: 37.7749,
  lng: -122.4194
}

Oakland: {
  address: "Oakland",
  lat: 37.8044,
  lng: -122.2712
}
```
