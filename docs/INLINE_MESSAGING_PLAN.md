# Inline Messaging Implementation Plan (v5.3)

**Status**: Planned for Next Session
**Priority**: High
**Estimated Effort**: 2-3 hours

## Overview

Add inline messaging within request cards so users can chat directly in the context of help offers, eliminating the need for a separate messages page.

## Current State (v5.2.0)

- ✅ Dashboard shows active requests with all offers
- ✅ Accept/reject flow implemented
- ✅ Messaging service exists (WebSocket + REST)
- ✅ Separate `/messages` page works
- ❌ No inline messaging in request cards

## Goal

Enable inline chat within request/offer cards with proper visibility rules:
- **Requester**: Sees all offer conversations (proposed and matched)
- **Helper (Proposed)**: Sees only their own conversation until accepted
- **Helper (Matched)**: Sees only conversation with requester after acceptance
- **Helper (Rejected)**: No longer sees the request

## Implementation Steps

### 1. Backend - Messaging Service Updates

**File**: `services/messaging-service/src/routes/messages.ts`

#### Current Conversation Creation
```typescript
// GET /messages/conversations/:matchId
// Already exists, may need enhancement
```

#### Enhancements Needed
- [ ] Ensure conversation is auto-created when match is created
- [ ] Add endpoint to get messages for a specific match
- [ ] Filter messages based on match status and user role

**New/Updated Endpoints**:
```typescript
// GET /messages/match/:matchId - Get conversation for a match
// Returns conversation_id and messages
// Filters based on:
//   - Match status (proposed/matched/rejected)
//   - User role (requester/responder)

// POST /messages/match/:matchId - Send message in match conversation
// Creates conversation if doesn't exist
// Validates user is participant
```

### 2. Frontend - Inline Message Component

**New Component**: `apps/frontend/src/components/InlineChat.tsx`

#### Props
```typescript
interface InlineChatProps {
  matchId: string
  currentUserId: string
  isRequester: boolean
  matchStatus: 'proposed' | 'matched' | 'rejected'
  otherParticipantName: string
}
```

#### Features
- Collapsible/expandable chat interface
- Real-time message updates via WebSocket
- Message input with send button
- Timestamp formatting (relative times)
- Auto-scroll to latest message
- Visual distinction between sent/received messages
- Typing indicators (future)
- Read receipts (future)

#### Design
```
┌─────────────────────────────────────────┐
│ 💬 Chat with Joshua (5 messages)     ▼ │
├─────────────────────────────────────────┤
│ Joshua: Hi, I can help with this!      │
│ 2h ago                                   │
│                                          │
│              You: Great! When are you   │
│              available?           1h ago│
│                                          │
│ Joshua: Tomorrow afternoon works        │
│ 30m ago                                  │
├─────────────────────────────────────────┤
│ [Type your message...            ] Send │
└─────────────────────────────────────────┘
```

### 3. Dashboard Integration

**File**: `apps/frontend/src/pages/dashboard.tsx`

#### Updates to Active Requests Section
```typescript
// Inside offer card (after Accept/Decline buttons)
{match.status === 'proposed' || match.status === 'matched' ? (
  <InlineChat
    matchId={match.id}
    currentUserId={user.id}
    isRequester={true}
    matchStatus={match.status}
    otherParticipantName={match.responder_name}
  />
) : null}
```

#### State Management
```typescript
// Add state for expanded chats
const [expandedChats, setExpandedChats] = useState<Set<string>>(new Set())

// Add state for message counts
const [messageCounts, setMessageCounts] = useState<{ [matchId: string]: number }>({})

// Fetch message counts on load
useEffect(() => {
  // For each match, fetch conversation and count unread messages
}, [myActiveRequests])
```

### 4. Community Requests Feed Integration

**Same file**: `apps/frontend/src/pages/dashboard.tsx`

After "Offer to Help" creates a match, show inline chat:

```typescript
const handleOfferToHelp = async (requestId: string) => {
  // ... existing code ...

  // After creating match, show chat
  const newMatch = response.data.data
  setExpandedChats(prev => new Set(prev).add(newMatch.id))
}
```

### 5. WebSocket Integration

**Hook**: Create `apps/frontend/src/hooks/useMessaging.ts`

```typescript
export function useMessaging(matchId: string) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const socketRef = useRef<Socket>()

  useEffect(() => {
    // Connect to WebSocket
    // Subscribe to match conversation
    // Listen for new messages
    // Fetch initial messages

    return () => {
      // Disconnect
    }
  }, [matchId])

  const sendMessage = async (content: string) => {
    // Send via WebSocket or REST fallback
  }

  return { messages, loading, sendMessage }
}
```

### 6. Visibility Rules Implementation

**Backend**: `services/messaging-service/src/middleware/messageAccess.ts`

```typescript
// Middleware to enforce visibility rules
export async function checkMessageAccess(req, res, next) {
  const { matchId } = req.params
  const userId = req.user.userId

  // Get match details
  const match = await getMatch(matchId)

  // Rules:
  // 1. Requester always sees messages
  if (match.requester_id === userId) return next()

  // 2. Responder sees only if status is proposed or matched
  if (match.responder_id === userId &&
      ['proposed', 'matched'].includes(match.status)) {
    return next()
  }

  // 3. Others cannot access
  return res.status(403).json({ error: 'Not authorized' })
}
```

### 7. Notification Integration

When a message is sent:
1. Create notification for recipient
2. Emit SSE event for real-time update
3. Show unread badge on dashboard

## API Changes Summary

### New Endpoints
```
GET  /messages/match/:matchId           - Get conversation for match
POST /messages/match/:matchId/messages  - Send message in match
GET  /messages/match/:matchId/unread    - Get unread count
PUT  /messages/match/:matchId/read      - Mark all as read
```

### Updated Frontend API Client
```typescript
// apps/frontend/src/lib/api.ts
export const messagingService = {
  // Existing methods...

  // New methods
  getMatchConversation: (matchId: string) =>
    messagingApi.get(`/messages/match/${matchId}`),

  sendMatchMessage: (matchId: string, content: string) =>
    messagingApi.post(`/messages/match/${matchId}/messages`, { content }),

  getUnreadCount: (matchId: string) =>
    messagingApi.get(`/messages/match/${matchId}/unread`),

  markRead: (matchId: string) =>
    messagingApi.put(`/messages/match/${matchId}/read`),
}
```

## Database Considerations

Current `messaging.conversations` table links to `request_match_id`:
```sql
CREATE TABLE messaging.conversations (
    id UUID PRIMARY KEY,
    request_match_id UUID REFERENCES requests.matches(id),
    last_message_at TIMESTAMP,
    created_at TIMESTAMP
);
```

✅ **No schema changes needed** - Already supports match-based conversations

## Testing Checklist

- [ ] Unit tests for visibility rules
- [ ] Integration test: Requester sees all messages
- [ ] Integration test: Proposed helper sees only their messages
- [ ] Integration test: Matched helper sees conversation
- [ ] Integration test: Rejected helper cannot access messages
- [ ] E2E test: Full conversation flow
- [ ] E2E test: Real-time message delivery

## UI/UX Considerations

1. **Expandable by Default**:
   - Show collapsed state with message count
   - Click to expand and show full conversation
   - Remember expanded state in session

2. **Message Indicators**:
   - Show unread count badge
   - Show typing indicator when other user is typing
   - Show "seen" status for sent messages

3. **Performance**:
   - Lazy load messages (show last 20, load more on scroll)
   - Debounce typing indicators
   - Use WebSocket for real-time, REST as fallback

4. **Mobile Responsive**:
   - Ensure chat works on mobile viewport
   - Consider modal/overlay on small screens

## Rollout Strategy

1. ✅ **Phase 1 (v5.2.0 - Current)**: Accept/reject flow, no inline chat
2. 🔄 **Phase 2 (v5.3.0 - Next)**: Add inline chat within requests
3. ⏳ **Phase 3 (v5.4.0 - Future)**: Remove standalone `/messages` page
4. ⏳ **Phase 4 (v5.5.0 - Future)**: Add typing indicators and read receipts

## Success Criteria

- [x] User can see inline chat within active requests
- [x] Requester sees all offer conversations
- [x] Helper sees only their conversation until accepted
- [x] Messages deliver in real-time via WebSocket
- [x] Unread counts display correctly
- [x] No separate messages page needed for request conversations
- [x] Tests pass for visibility rules

## Open Questions

1. **What happens to rejected offers?**
   - Suggestion: Hide the entire offer card from helper's view
   - Show "This offer was not accepted" message if they navigate directly

2. **Should we keep the `/messages` page?**
   - Short term: Yes, for backward compatibility
   - Long term: Deprecate once inline messaging is stable

3. **Message history limit?**
   - Load last 20 messages initially
   - "Load More" button to fetch earlier messages
   - Archive old messages after match completion (per ephemeral data policy)

## Related Files to Review

- `services/messaging-service/src/routes/messages.ts`
- `services/messaging-service/src/socket/index.ts`
- `apps/frontend/src/contexts/MessagingContext.tsx`
- `apps/frontend/src/pages/messages/[id].tsx` (for reference)

## Notes

- This completes the dashboard-centric workflow where everything happens in one place
- Eliminates context switching between dashboard and messages page
- Aligns with modern social media UX patterns (comments/messages inline with content)
