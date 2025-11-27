# Manual Testing Checklist - v5.3.0

**Version**: v5.3.0
**Date**: 2025-01-27
**Features**: Inline Messaging + Mark Complete + WebSocket Real-Time

---

## 🎯 Testing Objectives

Verify all features work correctly:
1. Inline messaging within request cards
2. Mark Complete workflow
3. WebSocket real-time messaging
4. Typing indicators
5. Multi-community posting
6. Accept/reject flow
7. End-to-end complete workflow

---

## 🔧 Setup

### Prerequisites
- [ ] All services running (`docker-compose ps` shows all healthy)
- [ ] Frontend accessible at http://localhost:3000
- [ ] Two browser windows or incognito mode ready
- [ ] Test users created (Alice and Bob)

### Service Health Check
```bash
cd infrastructure/docker
docker-compose ps
# All services should be "Up" and healthy
```

---

## 👥 Test Scenario: Two Users

**Alice** (Requester):
- Creates help request
- Receives offers from Bob
- Chats with Bob before accepting
- Accepts Bob's offer
- Marks exchange complete

**Bob** (Helper):
- Sees Alice's request
- Offers to help
- Chats with Alice
- Helps with the task
- Can also mark complete

---

## ✅ Test Cases

### 1. User Registration & Login

#### Alice Registration
- [ ] Navigate to http://localhost:3000/register
- [ ] Fill form:
  - Name: Alice Requester
  - Email: alice@test.com
  - Password: password123
- [ ] Click "Sign Up"
- [ ] Verify redirect to /communities
- [ ] Verify token stored in localStorage

#### Bob Registration
- [ ] Open incognito window or second browser
- [ ] Navigate to http://localhost:3000/register
- [ ] Fill form:
  - Name: Bob Helper
  - Email: bob@test.com
  - Password: password123
- [ ] Click "Sign Up"
- [ ] Verify redirect to /communities

---

### 2. Community Creation & Joining

#### Alice Creates Community
- [ ] Click "Create Community" on /communities page
- [ ] Fill form:
  - Name: Portland Mutual Aid
  - Description: Helping neighbors in Portland
  - Type: neighborhood
- [ ] Click "Create"
- [ ] Verify community appears in list
- [ ] Note the invite code shown

#### Bob Joins Community
- [ ] Copy invite code from Alice's window
- [ ] In Bob's window, click "Join Community"
- [ ] Enter invite code
- [ ] Click "Join"
- [ ] Verify "Portland Mutual Aid" appears in Bob's communities
- [ ] Verify status shows "member"

---

### 3. Create Help Request (Multi-Community)

#### Alice Creates Request
- [ ] Navigate to /dashboard
- [ ] In "Quick Create" section, enter description:
  - "Need help moving furniture this Saturday"
- [ ] Verify "All My Communities" is selected (default)
- [ ] Click "Post Request"
- [ ] Verify success message
- [ ] Verify request appears in "My Active Requests" (amber background)
- [ ] Verify request shows in "Community Requests" for Bob

#### Verify Request Visibility
**Alice's view**:
- [ ] Request appears in "My Active Requests" section
- [ ] Amber/yellow background
- [ ] Shows description and timestamp

**Bob's view**:
- [ ] Navigate to /dashboard
- [ ] Request appears in "Community Requests" section
- [ ] White background
- [ ] "Offer to Help" button visible

---

### 4. Offer to Help (Create Match)

#### Bob Offers to Help
- [ ] In Bob's window, find Alice's request
- [ ] Click "Offer to Help"
- [ ] Verify button changes or shows feedback
- [ ] Wait 1-2 seconds for refresh

**Alice's view**:
- [ ] Dashboard refreshes automatically
- [ ] Offer appears under request in "My Active Requests"
- [ ] Shows Bob's name and "offered Xm ago"
- [ ] "Accept" and "Decline" buttons visible
- [ ] Chat section visible (collapsed)

---

### 5. Inline Messaging (Pre-Acceptance)

#### Alice Expands Chat
- [ ] Find Bob's offer under request
- [ ] Click "Chat with Bob Helper" to expand
- [ ] Verify chat expands smoothly
- [ ] Verify "No messages yet - Start the conversation!" appears
- [ ] Verify message input is visible
- [ ] Check for "Live" indicator (green dot) when WebSocket connects

#### Alice Sends First Message
- [ ] Type in message input: "Hi Bob! When are you available?"
- [ ] Observe typing indicator behavior (debounced)
- [ ] Click "Send"
- [ ] Verify message appears instantly
- [ ] Verify message has blue background (sender)
- [ ] Verify timestamp shows "just now"
- [ ] Verify input clears after sending

#### Bob Receives Message (Real-Time)
- [ ] In Bob's window, find Alice's request
- [ ] Click "Offer to Help" button (if not already offered)
- [ ] Wait for page refresh
- [ ] Find the offer/match card
- [ ] Click to expand chat with Alice
- [ ] **CRITICAL**: Verify message from Alice appears WITHOUT page refresh
- [ ] Verify message has white background (receiver)
- [ ] Verify "Live" indicator shows (green dot)

#### Bob Responds
- [ ] In Bob's chat, type: "I'm free Saturday afternoon!"
- [ ] Watch for typing indicator in Alice's window
- [ ] Click "Send"

#### Alice Sees Bob's Message (Real-Time)
- [ ] In Alice's window, WITHOUT REFRESHING
- [ ] **CRITICAL**: Verify typing indicator appears (3 bouncing dots)
- [ ] **CRITICAL**: Verify "Bob Helper is typing..." message
- [ ] **CRITICAL**: Verify Bob's message appears instantly
- [ ] Verify message has white background (receiver)
- [ ] Verify auto-scroll to bottom

#### Test Typing Indicators
- [ ] Alice starts typing (don't send)
- [ ] In Bob's window, verify typing indicator appears
- [ ] Alice stops typing for 1 second
- [ ] Verify typing indicator disappears in Bob's window
- [ ] Repeat vice versa (Bob types, Alice sees indicator)

---

### 6. Accept Offer Flow

#### Alice Accepts Bob's Offer
- [ ] In Alice's window, find Bob's offer
- [ ] Click "Accept" button
- [ ] Verify success feedback
- [ ] Wait for dashboard refresh

**Verify Status Changes**:
- [ ] "Accept/Decline" buttons disappear
- [ ] Green "✓ Accepted" badge appears
- [ ] Blue "Mark Complete" button appears next to badge
- [ ] Chat remains visible and expanded

**Verify Other Offers Rejected**:
- [ ] If there were other offers, verify they show "Rejected" status
- [ ] Rejected offers should not show chat

---

### 7. Continue Chatting (Post-Acceptance)

#### Alice Sends Follow-Up
- [ ] In the still-expanded chat, type: "Perfect! Meet at 2pm?"
- [ ] Send message
- [ ] Verify instant delivery

#### Bob Responds
- [ ] In Bob's window, verify message received instantly
- [ ] Type response: "Sounds good, see you then!"
- [ ] Send message
- [ ] Verify Alice receives it without refresh

#### Test Connection Indicator
- [ ] Verify "Live" badge shows in both windows when chat expanded
- [ ] Collapse chat in Alice's window
- [ ] Verify "Live" badge disappears
- [ ] Expand again, verify it reappears (reconnects)

---

### 8. Mark Complete Flow

#### Alice Marks Complete
- [ ] In Alice's window, find the matched request
- [ ] Verify "✓ Accepted" badge and "Mark Complete" button
- [ ] Click "Mark Complete"
- [ ] Wait for refresh

**Verify Completion**:
- [ ] "Mark Complete" button disappears
- [ ] "✓ Accepted" badge replaced with "✓ Completed" badge
- [ ] Badge has purple background
- [ ] Chat may still be visible (depends on filter)

#### Bob's View After Completion
- [ ] In Bob's window, refresh or navigate
- [ ] Find the request (may be in different section)
- [ ] Verify shows "Completed" status

---

### 9. Multi-Community Posting

#### Alice Creates Second Community
- [ ] Navigate to /communities
- [ ] Create new community:
  - Name: Seattle Helpers
  - Description: Seattle area mutual aid
- [ ] Save community
- [ ] Get invite code

#### Alice Posts to All Communities
- [ ] Navigate to /dashboard
- [ ] In Quick Create, type: "Need gardening advice"
- [ ] Verify "All My Communities" is selected
- [ ] Click "Post Request"

**Verify Multi-Community**:
- [ ] Request appears in both Portland and Seattle communities
- [ ] Check database or API to confirm multiple records
- [ ] Navigate between communities to verify visibility

---

### 10. WebSocket Edge Cases

#### Test Disconnect/Reconnect
- [ ] Open chat (WebSocket connects)
- [ ] In browser DevTools, Network tab, filter "WS"
- [ ] Find WebSocket connection
- [ ] Right-click → Close connection (or disable network)
- [ ] Try sending a message
- [ ] Verify fallback to REST API works
- [ ] Re-enable network
- [ ] Expand chat again
- [ ] Verify WebSocket reconnects ("Live" badge)

#### Test Multiple Chats
- [ ] Create multiple matches with different users
- [ ] Expand multiple chats simultaneously
- [ ] Verify each has independent WebSocket connection
- [ ] Send messages in different chats
- [ ] Verify no cross-contamination

#### Test Message Deduplication
- [ ] Send a message
- [ ] Message should appear only once (not duplicated)
- [ ] Even if received via both WebSocket and REST

---

### 11. Error Handling

#### Invalid Token
- [ ] Clear localStorage
- [ ] Try to access /dashboard
- [ ] Verify redirect to /login
- [ ] Verify WebSocket doesn't connect without token

#### Network Error
- [ ] Stop messaging service: `docker stop karmyq-messaging-service`
- [ ] Try to send message
- [ ] Verify graceful error handling
- [ ] Restart service: `docker start karmyq-messaging-service`
- [ ] Verify recovery

#### Rate Limiting
- [ ] Send 50+ messages rapidly
- [ ] Verify no crashes
- [ ] Verify all messages delivered

---

### 12. UI/UX Quality

#### Visual Design
- [ ] Amber background for "My Active Requests"
- [ ] White background for "Community Requests"
- [ ] Green "✓ Accepted" badge
- [ ] Purple "✓ Completed" badge
- [ ] Blue "Mark Complete" button
- [ ] Green "Live" indicator with dot
- [ ] Smooth animations for typing indicator

#### Responsive Behavior
- [ ] Auto-scroll works on new messages
- [ ] Timestamps show relative time (5m ago, 2h ago)
- [ ] Chat expands/collapses smoothly
- [ ] Hover effects on buttons
- [ ] Loading spinners during fetches

#### Accessibility
- [ ] All buttons have clear labels
- [ ] Color contrast is sufficient
- [ ] Keyboard navigation works
- [ ] Screen reader friendly (basic check)

---

### 13. Performance

#### Page Load Time
- [ ] Dashboard loads in < 2 seconds
- [ ] No visible lag or jank
- [ ] Images/avatars load quickly

#### Real-Time Latency
- [ ] Messages appear in < 500ms
- [ ] Typing indicators appear in < 200ms
- [ ] No noticeable delay

#### Resource Usage
- [ ] Check browser DevTools → Performance
- [ ] CPU usage reasonable
- [ ] Memory doesn't leak over time
- [ ] WebSocket connections close properly

---

### 14. Karma Awards (Background Process)

#### Verify Karma After Completion
- [ ] After marking complete, wait 2-3 seconds
- [ ] Navigate to profile or reputation page
- [ ] Verify Alice's karma increased
- [ ] Verify Bob's karma increased
- [ ] Check specific point values match config

---

## 🐛 Bug Tracking

### Issues Found

| # | Description | Severity | Status | Notes |
|---|-------------|----------|--------|-------|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |

---

## ✅ Final Checklist

### Core Features
- [ ] User registration works
- [ ] Login/logout works
- [ ] Community creation works
- [ ] Community joining works
- [ ] Create request (single community)
- [ ] Create request (multi-community)
- [ ] Offer to help works
- [ ] Inline chat expands/collapses
- [ ] Send message works
- [ ] Messages appear in real-time
- [ ] Typing indicators work
- [ ] Accept offer works
- [ ] Auto-reject other offers
- [ ] Mark complete works
- [ ] Karma awarded

### WebSocket Features
- [ ] WebSocket connects on chat expand
- [ ] WebSocket disconnects on chat collapse
- [ ] Real-time message delivery (< 500ms)
- [ ] Typing indicators (start/stop)
- [ ] "Live" connection indicator
- [ ] Reconnection after disconnect
- [ ] REST fallback works

### UI/UX
- [ ] Visual design matches spec
- [ ] Responsive layout
- [ ] Smooth animations
- [ ] Clear feedback on actions
- [ ] No console errors
- [ ] No visual bugs

### Performance
- [ ] Fast page loads
- [ ] Low latency messaging
- [ ] Efficient resource usage
- [ ] No memory leaks

---

## 📝 Notes

**Date**: _______________
**Tester**: _______________

### Additional Observations


### Suggestions for Improvement


---

## 🎉 Sign-Off

- [ ] All critical features working
- [ ] No blocking bugs
- [ ] Performance acceptable
- [ ] Ready for deployment

**Tested by**: _______________
**Date**: _______________
**Signature**: _______________
