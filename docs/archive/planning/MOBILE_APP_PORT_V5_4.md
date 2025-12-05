# Mobile App Porting Plan - v5.4.0

**Date**: 2025-01-29
**Scope**: Port v5.3.0+ dashboard redesign and messaging to React Native mobile app

---

## Overview

Port the following features from frontend (Next.js) to mobile (React Native + Expo):

1. **Dashboard Redesign** (v5.3.0)
   - Multi-community request posting
   - Post-and-comment feed structure
   - Priority sections (My Requests, Offers, Community, Global)
   - Quick create with "Post to All" option

2. **Inline Messaging** (v5.3.1)
   - Match-based WebSocket messaging
   - Typing indicators
   - Real-time message delivery
   - Embedded in request detail screens

3. **Workflow Actions** (v5.3.0)
   - Accept/Decline offers
   - Mark requests complete
   - Inline action buttons

---

## Architecture

### Current Mobile Stack
- **Framework**: React Native 0.76.3 + Expo SDK 52
- **Router**: Expo Router v4 (file-based routing)
- **State**: Zustand for auth state
- **API**: Axios with service-based clients
- **WebSocket**: Will add `socket.io-client`

### Frontend→Mobile Mapping

| Frontend (Next.js) | Mobile (Expo Router) | Status |
|--------------------|----------------------|--------|
| `pages/dashboard.tsx` | `app/(tabs)/feed.tsx` | To update |
| `components/InlineChat.tsx` | `components/InlineChat.tsx` | To create |
| `hooks/useMessaging.ts` | `hooks/useMessaging.ts` | To create |
| `lib/api.ts` | `services/api.ts` | ✅ Updated |

---

## Implementation Plan

### Phase 1: API Layer (COMPLETED ✅)

**File**: `apps/mobile/services/api.ts`

Added endpoints:
- `createRequest()` - Multi-community posting with `post_to_all_communities`
- `updateRequest()`, `cancelRequest()`
- `getMatches()`, `getMatch()`
- `acceptMatch()`, `declineMatch()`, `completeMatch()`
- `getMatchMessages()`, `sendMatchMessage()`, `markMatchMessagesRead()`

---

### Phase 2: Dashboard Redesign

**File**: `apps/mobile/app/(tabs)/feed.tsx` (rename from `requests.tsx`)

#### Feed Structure
```typescript
interface FeedItem {
  type: 'request'
  priority: 'my_requests_matched' | 'accepted_offers' | 'community' | 'global'
  request: HelpRequest
  matches?: Match[]
  canAcceptDecline: boolean
  canMarkComplete: boolean
  showChat: boolean
}
```

#### Sections
1. **My Requests with Offers** (Amber)
   - My `matched` requests
   - Show all offers as "comments"
   - Accept/Decline buttons for each offer

2. **Offers I'm Helping With** (Green)
   - Matches where I'm the responder
   - Status: `accepted` or `in_progress`
   - Mark Complete button
   - Inline chat

3. **Community Requests** (Blue)
   - Open requests from my communities
   - Exclude my own requests
   - "Offer Help" button

4. **Global Requests** (Gray)
   - Open requests from all communities
   - "Offer Help" button

#### UI Components
- Quick Create (top card)
- Feed list with priority colors
- Collapsible "comments" (offers)
- Inline action buttons
- Chat widget (when expanded)

---

### Phase 3: Inline Chat Component

**File**: `apps/mobile/components/InlineChat.tsx`

Port from `apps/frontend/src/components/InlineChat.tsx`:

```typescript
interface InlineChatProps {
  matchId: string
  userId: string
  otherUserName: string
  onClose?: () => void
}
```

#### Features
- Message list (FlatList, inverted)
- Input field with send button
- Typing indicators
- WebSocket real-time updates
- Auto-scroll to latest

#### Mobile-Specific Adaptations
- Use `KeyboardAvoidingView` for iOS
- Use `FlatList` instead of `div` scrolling
- Touch-optimized message bubbles
- Native `TextInput` component

---

### Phase 4: WebSocket Hook

**File**: `apps/mobile/hooks/useMessaging.ts`

Port from `apps/frontend/src/hooks/useMessaging.ts`:

```typescript
export function useMessaging(matchId: string, userId: string) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [typing, setTyping] = useState(false)
  const socket = useRef<Socket | null>(null)

  // Connect to WebSocket
  // Load initial messages
  // Handle real-time events
  // Send messages
  // Typing indicators
}
```

#### Dependencies
Add to `apps/mobile/package.json`:
```json
{
  "socket.io-client": "^4.7.2"
}
```

#### Mobile-Specific Considerations
- Handle app backgrounding (disconnect socket)
- Handle app foregrounding (reconnect socket)
- Use Expo's `AppState` API for lifecycle events

---

### Phase 5: Request Detail Screen

**File**: `apps/mobile/app/requests/[id].tsx` (create if not exists)

#### Layout
```
┌─────────────────────────────┐
│ Request Title               │
│ Status • Category           │
│ Description...              │
│                             │
│ ┌─────────────────────────┐ │
│ │ Offer from Alice        │ │
│ │ [Accept] [Decline]      │ │
│ └─────────────────────────┘ │
│                             │
│ ┌─────────────────────────┐ │
│ │ Inline Chat             │ │
│ │ Messages...             │ │
│ │ [Type message...]       │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

#### Features
- Display request details
- List all offers (matches)
- Accept/Decline buttons (if requester)
- Mark Complete button (if accepted)
- Inline chat (if matched & accepted)

---

### Phase 6: Quick Create Widget

**Component**: Embedded in `feed.tsx`

#### UI
```
┌─────────────────────────────┐
│ What do you need help with? │
│ ┌─────────────────────────┐ │
│ │ Type here...            │ │
│ └─────────────────────────┘ │
│                             │
│ ○ Post to all communities   │
│ ● Post to: [Oakland ▼]      │
│                             │
│ [Post Request]              │
└─────────────────────────────┘
```

#### Logic
- Toggle between "all" and "specific" community
- Dropdown for community selection
- Create request via API
- Refresh feed on success

---

## Testing Plan

### Manual Testing
1. **Dashboard**
   - [ ] Load feed with all 4 priority sections
   - [ ] Quick create (post to all communities)
   - [ ] Quick create (post to specific community)
   - [ ] Expand/collapse offers
   - [ ] Accept/Decline offers
   - [ ] Mark request complete

2. **Messaging**
   - [ ] Open inline chat
   - [ ] Send message
   - [ ] Receive message (WebSocket)
   - [ ] Typing indicators
   - [ ] Keyboard handling (iOS/Android)

3. **Navigation**
   - [ ] Tap request → detail screen
   - [ ] Back navigation
   - [ ] Tab switching

### Automated Testing
```bash
cd apps/mobile
npm run test
```

---

## Migration Notes

### Breaking Changes
- `requests.tsx` renamed to `feed.tsx`
- `community_id` is now optional (multi-community posting)
- Added `post_to_all_communities` flag
- Messages are match-based, not conversation-based

### Backwards Compatibility
- Legacy conversation API still supported
- Old `getRequests()` params still work
- Graceful fallback for missing matches

---

## Performance Optimizations

### Mobile-Specific
1. **Lazy Loading**
   - Load feed in chunks (limit: 20)
   - Infinite scroll with `onEndReached`

2. **Caching**
   - Cache messages in AsyncStorage
   - Cache user communities in Zustand

3. **WebSocket**
   - Disconnect on app background
   - Reconnect on app foreground
   - Debounce typing indicators (300ms)

4. **Image Loading**
   - Use `expo-image` with blurhash
   - Lazy load user avatars

---

## Deployment

### Development
```bash
cd apps/mobile
npm install
npx expo start
```

### iOS
```bash
npx expo run:ios
```

### Android
```bash
npx expo run:android
```

### Web (Preview)
```bash
npm run web
```

---

## Timeline Estimate

| Phase | Description | Time |
|-------|-------------|------|
| 1 | API Layer | ✅ Done (30 min) |
| 2 | Dashboard Redesign | 3-4 hours |
| 3 | Inline Chat Component | 2-3 hours |
| 4 | WebSocket Hook | 1-2 hours |
| 5 | Request Detail Screen | 2-3 hours |
| 6 | Quick Create Widget | 1 hour |
| **Total** | | **9-13 hours** |

---

## Next Steps

1. Install `socket.io-client` dependency
2. Create `useMessaging` hook
3. Create `InlineChat` component
4. Update `feed.tsx` with dashboard redesign
5. Create/update `requests/[id].tsx`
6. Test on iOS and Android emulators
7. Test on physical devices

---

**Status**: Ready for implementation
**Owner**: Development Team
**Review Date**: 2025-02-05
