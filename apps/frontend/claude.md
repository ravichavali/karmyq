# Frontend Web Application

## Overview
Next.js 14 web app with Pages Router and Tailwind CSS.

## Structure
```
src/
├── components/     # Reusable React components
│   └── Layout.tsx  # Main layout with navigation
├── lib/
│   └── api.ts      # API client with all service calls
├── pages/          # Next.js pages (file-based routing)
│   ├── _app.tsx    # App wrapper
│   ├── index.tsx   # Dashboard/Landing
│   ├── login.tsx   # Login page
│   ├── register.tsx
│   ├── communities/
│   │   ├── index.tsx       # List communities
│   │   ├── new.tsx         # Create community
│   │   ├── [id].tsx        # Community detail
│   │   └── [id]/admin.tsx  # Admin settings
│   ├── requests/
│   └── offers/
└── styles/
    └── globals.css # Tailwind imports
```

## API Client (`src/lib/api.ts`)
Centralized API client with service-specific modules:
- `authService` - Login, register, logout
- `communityService` - CRUD, members, norms, settings
- `requestService` - Help requests
- `offerService` - Help offers
- `feedService` - Activity feed

## Authentication Pattern
```typescript
// Check auth on mount
useEffect(() => {
  const token = localStorage.getItem('token');
  if (!token) router.push('/login');
}, []);

// API calls include token automatically via interceptor
```

## Environment Variables
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_COMMUNITY_API_URL=http://localhost:3002
NEXT_PUBLIC_REQUEST_API_URL=http://localhost:3003
```

## Development
```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # Production build
npm run lint    # ESLint
```
