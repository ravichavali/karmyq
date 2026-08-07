# Mobile Application

React Native + Expo, iOS and Android.

```
app/               Expo Router screens (file-based)
├── _layout.tsx    root layout
├── index.tsx
├── (auth)/        login.tsx, register.tsx, _layout.tsx
├── (tabs)/        feed, communities, requests, messages, profile
├── community/     [id].tsx
└── requests/      [id].tsx
components/        InlineChat.tsx, QuickCreate.tsx
config/  hooks/  utils/  assets/
services/          api.ts (base client), notifications.ts
store/             auth.ts — the single Zustand store
tests/
```

## Tech stack

Expo SDK 57 · React Native 0.86.2 · React 19.2.3 · Expo Router · **Zustand 5.0.14** · axios ·
`@expo/vector-icons` · `react-native-maps` · `react-native-reanimated` · `expo-secure-store` ·
`expo-notifications` · `expo-camera` / `-location` / `-image-picker`.

**There is no React Native Paper** and no Redux — an older version of this file claimed both. UI is
hand-rolled with `@expo/vector-icons`; state is the one Zustand store in `store/auth.ts`.

## Recent changes

- **Sprint 122 PR 6:** Zustand 4.5.7 → 5.0.14. The sole store already used the supported named
  `create` export and touches neither the removed default-export shim nor the
  `createWithEqualityFn`/custom-equality selector APIs, so no store-code migration was required.

## Development

**Prerequisites**

- Node `^22.13.0 || ^24.3.0 || >=25.0.0` — i.e. 22.13+, 24.3+, or anything from 25 on (CI runs
  24.x). Node 20, 21, 23, and 22.x/24.x below those patch floors are excluded.
- **Use `npx expo <command>`** — the global `expo-cli` package is deprecated and must not be installed.
- iOS needs Xcode (Mac only); Android needs Android Studio + an emulator.

```bash
cd apps/mobile
npm install
npx expo start      # 'i' iOS · 'a' Android · scan QR for Expo Go
npm run type-check  # tsc --noEmit
npm run lint
npm test            # jest
npm run test:e2e    # maestro test .maestro/flows/
```

## ⚠️ The API host is HARDCODED, not read from `.env`

`config/api.ts` currently sets `const API_HOST = "192.168.0.163"` — a specific LAN IP. The
`EXPO_PUBLIC_API_HOST` path is commented out pending a Metro bundler env-var issue (ROADMAP
Backlog #25). **On a fresh machine nothing reaches the backend until you edit that constant.**

So: the env var to care about is `EXPO_PUBLIC_API_HOST` (a *host*, not a URL) — and it is inert
today. `API_CONFIG` derives one URL per service from that host: auth 3001, community 3002, request
3003, reputation 3004, notification 3005, messaging 3006. The intended fallback, once restored, is
`10.0.2.2` on Android emulators and `localhost` elsewhere.

## API pattern (`services/api.ts`)

A `createClient(baseURL)` factory — one axios client per service, not a single instance:

```typescript
import axios, { AxiosInstance } from 'axios'
import { storage } from '@/utils/storage'
import { API_CONFIG } from '@/config/api'

const createClient = (baseURL: string): AxiosInstance => {
  const client = axios.create({ baseURL, headers: { 'Content-Type': 'application/json' } })
  client.interceptors.request.use(async (config) => {
    const token = await storage.getItem('token')
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  })
  return client
}
```

**Tokens go through `utils/storage.ts`, never `AsyncStorage`** (which isn't a dependency). That
wrapper is `expo-secure-store` on native and `localStorage` on web.

The JWT payload field is **`communities`**, not `communityMemberships`, and claims are login-time
snapshots — the server re-derives membership on every authorization decision.

## Upgrade gotcha

Expo's SDK→package version map is **non-monotonic**: a newer SDK can pin an *older* patch of a
bundled package. Always resolve versions against `npx expo install --check` / the live SDK map
rather than assuming newer is correct, and verify against `node_modules` — not a changelog.
