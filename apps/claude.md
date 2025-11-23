# Apps Directory

## Overview
Frontend applications for web and mobile platforms.

## Applications

### frontend/ (Port 3000)
Next.js 14 web application with:
- Pages Router (`src/pages/`)
- Tailwind CSS styling
- API client in `src/lib/api.ts`
- Layout components in `src/components/`

Key pages:
- `/` - Landing/Dashboard
- `/login`, `/register` - Authentication
- `/communities` - Community list
- `/communities/[id]` - Community detail
- `/communities/[id]/admin` - Admin settings (admins only)
- `/requests`, `/offers` - Help requests/offers

### mobile/
React Native + Expo application:
- Expo Router for navigation
- Redux Toolkit for state
- Services in `services/` for API calls
- Currently: Feed screen implemented, others pending

## Shared Code
Both apps import from `packages/shared/` for:
- Type definitions
- API response types
- Constants

## Development

### Frontend (Web)
```bash
cd apps/frontend
npm install
npm run dev  # http://localhost:3000
```

### Mobile
```bash
cd apps/mobile
npm install
npx expo start
# Press 'i' for iOS, 'a' for Android
```

## API Client Pattern
All API calls go through `src/lib/api.ts`:
```typescript
// Uses axios with baseURL and auth interceptor
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
});

// Auth header automatically added from localStorage token
```
