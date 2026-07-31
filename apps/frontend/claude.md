# Frontend Web Application

## Overview
Next.js 15 web app with Pages Router and Tailwind CSS v4.

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
    ├── globals.css      # @import "tailwindcss" + the @theme design tokens
    └── karmyq-shell.css # .kq-* shell; needs its @reference to globals.css
```

## Styling (Tailwind v4, CSS-first)
There is **no `tailwind.config.js`** — the theme lives in `@theme` inside `globals.css`, and every
design token is a real CSS color there (see ADR-079). Two rules that bite:

- **`karmyq-shell.css` is imported standalone by `_app.tsx`**, so Tailwind compiles it with no theme
  in scope. Its `@reference './globals.css'` is load-bearing: remove it and every `@apply` in that
  file resolves to nothing *silently*.
- **`@apply` only works on registered utilities.** A class defined in `@layer components` cannot be
  `@apply`-ed — that is a hard build error. If a class needs to be composed by another rule, declare
  it with `@utility` (as `.btn-primary` and `.card` are).

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
