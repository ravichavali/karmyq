# ADR-005: Minimalist Dashboard Design

**Date**: 2025-12-29
**Status**: Accepted
**Deciders**: Development Team, User Feedback
**Related**: DEVELOPMENT_ROADMAP.md Decision Log (Session 8e414c6e)

## Context

The dashboard is the main entry point after login. We needed to decide what information and actions to show on the dashboard to create an effective, engaging user experience.

### Initial Approach

Early prototypes showed extensive information:
- All karma/reputation stats
- Community list with details
- Skills and profile info
- Leaderboards
- Activity feed
- Multiple CTAs

### Problem

- **Information overload**: Too much on one screen
- **Mobile unfriendly**: Cramped on small screens
- **Unclear focus**: What should users do first?
- **Cognitive load**: Hard to decide what to look at
- **Performance**: Slow to load all data

## Decision

**We will adopt a minimalist, action-focused dashboard** that emphasizes helping others over self-promotion.

### Core Principles

1. **Mobile-first**: Design for smallest screen, scale up
2. **Action-oriented**: Focus on what users can DO, not stats
3. **Helping first**: Prioritize helping others over requesting help
4. **Progressive disclosure**: Info available when needed, not always visible
5. **Clean design**: Whitespace, clear hierarchy, limited colors

### Dashboard Layout

**Main Content**:
- **Matched Requests** - Help requests matching user's skills (primary focus)
- **Quick Request Creation** - Natural language input with type selection
- **My Active Requests** - User's own pending requests

**Sidebar (Collapsible)**:
- Left: Karma/trust scores (minimized by default)
- Right: Community health, milestones (minimized by default)

**What's NOT on Dashboard**:
- ❌ Detailed karma breakdown
- ❌ Community member lists
- ❌ Skills management
- ❌ Leaderboards
- ❌ Notifications (separate page)
- ❌ Messages (separate page)

These moved to dedicated pages (Profile, Communities, Notifications).

## Consequences

### Positive Consequences

- **Clarity**: Users know exactly what to do (help others or ask for help)
- **Mobile-friendly**: Works great on phones
- **Faster load**: Less data to fetch and render
- **Better engagement**: Clear CTAs increase action rate
- **Reduced cognitive load**: Simple decisions, not overwhelming
- **Scalable**: Works for users in 1 community or 20
- **Focus on value**: Helping others is front and center

### Negative Consequences

- **Less discovery**: Users might not know about features in other pages
- **Stats hidden**: Power users who want to see karma have to click
- **More navigation**: Need to go to profile for detailed info
- **Initial confusion**: Some users expect "dashboard" to show everything

### Neutral Consequences

- **Design consistency**: Other pages follow same minimal approach
- **Information architecture**: Clear separation of concerns across pages
- **Onboarding important**: Need to teach users where things are

## Alternatives Considered

### Alternative 1: Expansive Dashboard

- **Description**: Show all info on dashboard (karma, communities, skills, feed, etc.)
- **Pros**:
  - Everything in one place
  - No navigation needed
  - Meets traditional "dashboard" expectations
- **Cons**:
  - Information overload
  - Slow to load
  - Poor mobile experience
  - Unclear what to do first
- **Why rejected**: Too overwhelming, especially on mobile

### Alternative 2: Customizable Dashboard

- **Description**: Let users choose what widgets to show
- **Pros**:
  - Personalized experience
  - Power users can see everything
  - Flexible for different use cases
- **Cons**:
  - Complex to implement
  - Adds configuration burden
  - Most users won't customize
  - More maintenance
- **Why rejected**: Over-engineering for MVP

### Alternative 3: Feed-First Dashboard

- **Description**: Make activity feed the primary focus (like Facebook)
- **Pros**:
  - Engaging content
  - Shows community activity
  - Familiar pattern
- **Cons**:
  - Passive consumption vs active helping
  - Less action-oriented
  - Feed can be empty for small communities
- **Why rejected**: Doesn't align with "mutual aid" focus

### Alternative 4: Request-First Dashboard

- **Description**: Show ALL open requests in all communities
- **Pros**:
  - Maximum help opportunities
  - Good for active helpers
- **Cons**:
  - Overwhelming with many communities
  - No prioritization
  - Signal-to-noise ratio poor
- **Why rejected**: Matched requests (filtered by skills) are better

## Implementation Notes

### Files Affected

- `apps/frontend/src/pages/dashboard.tsx` - Main dashboard component
- `apps/frontend/src/components/LeftSidebar.tsx` - Karma sidebar
- `apps/frontend/src/components/RightSidebar.tsx` - Community health sidebar
- `apps/frontend/src/pages/profile.tsx` - Detailed stats moved here

### Dashboard Sections

**1. Matched Requests** (Primary Focus):
```typescript
// Shows requests matching user's skills
const matchedRequests = await requestService.getMatchedRequests(userId, limit);
```

**2. Quick Create**:
- Natural language textarea
- Type selector (Ride, Event, Service, Borrow, Generic)
- Post to all communities or specific one
- Inline validation and error handling

**3. My Requests**:
- User's own active requests
- Status indicators (open, matched, completed)
- Quick actions (edit, cancel)

### Mobile Layout

- Single column on mobile (<768px)
- Sidebars become tabs or collapse completely
- Touch-friendly buttons (44x44px minimum)
- Bottom navigation for primary actions

### User Feedback

Previous session user feedback:
> "Preferred compact design, not overwhelming"

User validated minimalist approach during development.

## Future Considerations

### Personalization

Could add simple preferences without full customization:
- Show/hide sidebars by default
- Sort matched requests by urgency vs distance
- Filter by request type

### Smart Matching

Improve "Matched Requests" algorithm:
- Distance-based ranking
- Urgency weighting
- Past interaction history
- Trust path strength

### Gamification (Careful)

Subtle gamification without becoming stats-focused:
- Streak badges (helped X days in row)
- First-time helper celebration
- Keep it supportive, not competitive

## References

- Dashboard implementation: `apps/frontend/src/pages/dashboard.tsx`
- Previous decision: DEVELOPMENT_ROADMAP.md Decision Log (Session 8e414c6e)
- User feedback: "Positive, preferred compact design"
- Mobile-first design: https://www.lukew.com/ff/entry.asp?933
