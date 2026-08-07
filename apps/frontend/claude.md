# Frontend Web Application

Next.js 15, **Pages Router**, Tailwind CSS v4. Port 3000.

```
src/
├── components/   # React components (Layout.tsx = shell + nav)
├── contexts/     # React contexts
├── hooks/        # custom hooks
├── lib/api.ts    # THE API client — every service call goes through here
├── pages/        # file-based routes (42 pages)
├── styles/
│   ├── globals.css      # @import "tailwindcss" + the @theme design tokens
│   └── karmyq-shell.css # .kq-* shell; needs its @reference to globals.css
├── types/
└── utils/
```

Routes include `/`, `/login`, `/register`, `/welcome`, `/dashboard`, `/communities/*`, `/requests/*`,
`/offers/*`, `/matches/*`, `/providers/*`, `/reputation/*`, `/admin/*`, `/network`, `/profile`,
`/settings/*`, `/notifications`, `/invitations`, `/demo`.

---

## ⚠️ Styling (Tailwind v4, CSS-first)

There is **no `tailwind.config.js`** — the theme lives in `@theme` inside `globals.css`, and every
design token is a real CSS color there (see [ADR-079](../../docs/adr/ADR-079-visual-design-system-v2.md)).
Two rules that bite:

- **`karmyq-shell.css` is imported standalone by `_app.tsx`**, so Tailwind compiles it with no theme
  in scope. Its `@reference './globals.css'` is load-bearing: remove it and every `@apply` in that
  file resolves to nothing *silently*.
- **`@apply` only works on registered utilities.** A class defined in `@layer components` cannot be
  `@apply`-ed — that is a hard build error. If a class needs to be composed by another rule, declare
  it with `@utility` (as `.btn-primary` and `.card` are).

When upgrading styles, diff **computed styles against the live site** rather than trusting an
upgrade guide, and confirm any class rename against the compiler.

## ⚠️ The API client already unwraps the envelope

`src/lib/api.ts:81-88` installs a response interceptor that collapses the ADR-074 envelope
(`{ success, data, meta }`) into `response.data`. So:

```typescript
const res = await requestService.getById(id)
res.data        // ✅ the payload
res.data.data   // ❌ undefined — a recurring bug
```

`api.ts` is **not** a single axios instance. It's a `createApiClient(baseURL)` factory, one client
per service, because each service has its own origin. It exports ~22 service modules —
`communityService`, `requestService`, `feedService`, `messagingService`, `notificationService`,
`reputationService`, `socialGraphService`, `providerService`, `collectiveService`, `dibsService`,
`uiSchemaService`, `userSettingsService`, `trustQuestionsService`, and more. **There is no
`authService` or `offerService`** — check the file for the current names rather than guessing.

`js/request-forgery` on this file is a **documented CodeQL false positive**; surface it for
dismissal rather than restructuring the client around it.

## Environment variables

One per service origin — all seven are read by `api.ts`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001            # auth
NEXT_PUBLIC_COMMUNITY_API_URL=http://localhost:3002
NEXT_PUBLIC_REQUEST_API_URL=http://localhost:3003
NEXT_PUBLIC_REPUTATION_API_URL=http://localhost:3004
NEXT_PUBLIC_NOTIFICATION_API_URL=http://localhost:3005
NEXT_PUBLIC_MESSAGING_API_URL=http://localhost:3006
NEXT_PUBLIC_SOCIAL_GRAPH_API_URL=http://localhost:3010
```

## Authentication

Token in `localStorage`, attached by a request interceptor. The JWT payload field is
**`communities`**, not `communityMemberships` — the wrong one is always `undefined`, so every check
silently 403s. After joining a community, **decode the fresh JWT** to rebuild frontend state; never
hand-construct the communities array.

Claims are login-time snapshots and are role *hints* only. Anything that gates visibility or writes
must be authorized server-side against a live membership lookup.

## Commands & tests

```bash
npm run dev     # http://localhost:3000
npm run build
npm run lint    # eslint src
npm test        # tests/unit + tests/regression (blocking pair)
```

Tests follow the standard tiers in `tests/{unit,regression,tdd,integration}/`. New work starts in
`tests/tdd/`. **`jest.setup.js` already mocks `next/router` globally** — don't add a per-file mock
unless you need different behavior (a local `jest.mock` takes precedence).

Minimum coverage for UI changes: new component → renders + edge cases; role/state-gated render →
shown for authorized *and* hidden for unauthorized; API call wired to an action → mock asserts the
payload; data fetch on mount → data path *and* graceful error fallback.
