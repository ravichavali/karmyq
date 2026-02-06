# UX Assessment: Polymorphic Request System
**Date**: 2026-02-05
**Assessment By**: Claude (Phase 1 Verification)

---

## Executive Summary

The polymorphic request system (v9.0) is **architecturally complete** but has **significant UX problems** that could overwhelm users and reduce engagement.

**Key Issues:**
1. ❌ **Forced Type Selection**: Users MUST choose request type before creating (no smart default)
2. ❌ **No Feed Curation**: Feed shows ALL requests regardless of user's ability to help
3. ❌ **No Match Scores**: Users can't see which requests match their skills
4. ❌ **Wizard Friction**: 2-step wizard adds unnecessary clicks

**Risk**: The "Everything App" approach risks becoming overwhelming without proper curation and progressive disclosure.

---

## Detailed Findings

### 1. Posting Flow UX (`/requests/new`)

**Current Implementation** ([new.tsx](apps/frontend/src/pages/requests/new.tsx)):

```typescript
// Lines 32-33: Initial state requires type selection
const [selectedType, setSelectedType] = useState<RequestType | null>(null)

// Lines 140-181: Shows type selector FIRST
const showTypeSelector = !selectedType

{showTypeSelector && (
  <RequestTypeSelector
    selectedType={selectedType}
    onSelectType={handleTypeSelect}
  />
)}
```

**Problems:**

| Issue | Impact | Evidence |
|-------|--------|----------|
| No default type | High | Line 33: `selectedType` starts as `null`, user MUST choose |
| Type selector blocks form | High | Line 140: Form only appears AFTER type selection |
| Two-step wizard | Medium | Lines 150-173: Progress indicator shows 2 required steps |
| Equal weight to all types | Medium | All 5 types presented equally (no "most common" hint) |
| Cannot skip to simple case | High | No way to quickly create generic request |

**User Journey:**
1. Land on `/requests/new`
2. See type selector (5 equal options)
3. Must choose type (cognitive load!)
4. Fill form details
5. Submit

**Estimated Clicks**: 5-7 clicks (vs. target: < 3)

**UX Violations:**
- ❌ No smart defaults
- ❌ No progressive disclosure
- ❌ Forced decision upfront
- ❌ High cognitive load for simple tasks

---

### 2. Feed Curation (`/requests`)

**Current Implementation** ([index.tsx](apps/frontend/src/pages/requests/index.tsx)):

```typescript
// Lines 38-45: Fetches ALL requests without personalization
const fetchRequests = async () => {
  const params: any = { limit: 50 }

  if (filter.status) params.status = filter.status
  if (filter.category) params.type = filter.category  // Old category system!

  const response = await requestService.getRequests(params)  // GET /requests
  setRequests(response.data.data)
}
```

**Problems:**

| Issue | Impact | Evidence |
|-------|--------|----------|
| No skill-based filtering | **Critical** | Line 45: Uses `GET /requests` (shows all) |
| No match scores visible | **Critical** | Lines 147-206: No match score display in cards |
| Old category system | High | Line 43: Uses `filter.category` (not `request_type`) |
| No personalization | High | All users see same feed |
| No curated/matched endpoint | High | `GET /requests/matched/for-user` exists but unused |

**Current Filters:**
- ✅ Status (open, matched, completed)
- ✅ Category (old system: physical_help, skills, resources, etc.)
- ❌ Request type (generic, ride, borrow, service, event)
- ❌ Match score
- ❌ Skills-based relevance

**Information Architecture Problems:**
1. **Cognitive Overload**: Users see 50 requests, many irrelevant
2. **No Relevance Signals**: Can't tell which requests they can help with
3. **Hidden Matching Algorithm**: Existing matching logic not surfaced to users
4. **Old System Artifacts**: Category field (line 43) predates polymorphic types

---

### 3. Matching Algorithm Integration

**Existing Infrastructure** (Confirmed via code exploration):

| Component | Status | Location |
|-----------|--------|----------|
| Type-specific matchers | ✅ Implemented | `packages/shared/src/matching/` |
| Match score calculation | ✅ Working | `calculateMatch()`, `findCandidates()` |
| Skill-based matching | ✅ Available | `GenericMatcher`, `ServiceMatcher` |
| Location-based matching | ✅ Available | `RideMatcher` (uses lat/lng) |
| GET /matched/for-user | ✅ Exists | `services/request-service/src/routes/requests.ts` |
| Frontend integration | ❌ **NOT USED** | Feed uses `GET /requests` instead |
| Match score display | ❌ **MISSING** | No UI component to show scores |

**Gap**: The matching algorithm infrastructure exists but is **completely disconnected** from the user-facing feed.

---

### 4. Progressive Disclosure Analysis

**Current State**: ❌ **No progressive disclosure**

- All 5 request types presented equally
- Type selector cannot be collapsed/skipped
- No "simple mode" vs "advanced mode"
- No contextual hints about which type to use

**Ideal State** (from plan):
- Start with generic form (simple)
- Show "or choose specific type" (collapsed)
- Progressive disclosure for power users
- Examples/hints for each type

---

### 5. Request Type Selector Component

**File**: `apps/frontend/src/components/requests/RequestTypeSelector.tsx`

**Current Features**:
- Shows 5 type options
- Visual selection indicator
- Type icons (likely)

**Missing Features**:
- ❌ No "Most common" badge for generic
- ❌ No usage examples ("e.g., ride to airport")
- ❌ No progressive disclosure (always visible)
- ❌ No smart defaults

---

## UX Metrics & Targets

### Current Performance (Estimated)

| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| Clicks to create generic request | 5-7 | < 3 | ❌ Missing |
| Type selector initially hidden | No | Yes | ❌ Missing |
| Match score > 30% in feed | N/A | 80%+ | ❌ Missing |
| Feed personalization | 0% | 100% | ❌ Missing |
| Match reasons visible | No | Yes | ❌ Missing |

### User Task Completion

| Task | Current UX | Issues |
|------|------------|--------|
| Create simple help request | 5+ clicks, must choose type | Too much friction |
| Find requests I can help with | Manual scanning of 50 items | No filtering |
| Understand why request matches me | Not possible | No match scores shown |
| Filter feed by skills | Not possible | No skill-based filters |
| Create specialized request (ride) | Must know to choose "ride" type | No guidance |

---

## Risk Assessment

### High Priority Risks

1. **User Confusion** (Likelihood: High, Impact: High)
   - New users don't understand 5 request types
   - No guidance on which type to choose
   - Risk: Users abandon request creation

2. **Feed Noise** (Likelihood: High, Impact: High)
   - Users see requests they can't help with
   - No personalization or filtering
   - Risk: User disengagement, reduced helping behavior

3. **Complexity Creep** (Likelihood: Medium, Impact: High)
   - "Everything App" becomes overwhelming
   - Power features hurt casual users
   - Risk: Platform perceived as too complicated

### Medium Priority Risks

4. **Existing Infrastructure Waste** (Likelihood: High, Impact: Medium)
   - Matching algorithms exist but unused in feed
   - `GET /requests/matched/for-user` endpoint orphaned
   - Risk: Duplicate work, technical debt

5. **No Type Discovery** (Likelihood: Medium, Impact: Medium)
   - Users don't know specialized types exist
   - Generic requests used for everything
   - Risk: Polymorphic system underutilized

---

## Recommendations (Priority Order)

### Must Fix (Blocking Phase 2)

1. **Implement Smart Defaults** (Day 6)
   - Default to generic request form
   - Collapse type selector initially
   - < 3 clicks for common case

2. **Implement Feed Curation** (Day 7)
   - Add `GET /requests/curated` endpoint
   - Show match scores on cards
   - Filter by minimum match score

3. **Add Interest Subscriptions** (Day 8)
   - User preferences for request types
   - Interest-based filtering
   - Opt-in to specific categories

### Should Fix (Phase 1.5)

4. **Progressive Disclosure**
   - "Most requests work as generic" hint
   - Collapsible advanced options
   - Contextual examples for types

5. **Match Score Transparency**
   - Badge component showing % match
   - Hover tooltip with reasons
   - "Why this matches you" explanations

### Nice to Have (Post-Phase 1)

6. **Type Usage Analytics**
   - Track which types are used
   - Identify underutilized types
   - Data-driven UX improvements

7. **Smart Type Suggestions**
   - Analyze request text
   - Suggest "This looks like a ride request"
   - Context-aware recommendations

---

## Comparison: Current vs. Target UX

### Posting Flow

**Current (Problematic)**:
```
Landing → Type Selector (5 choices) → Form Details → Submit
          ↑ Blocking                    ↑ Hidden until type chosen
```

**Target (Improved)**:
```
Landing → Generic Form (default) → Submit
             ↓ Optional
          Advanced Type Selector (collapsed)
```

### Feed Experience

**Current (Problematic)**:
```
User → Feed (all 50 requests) → Manual Scanning → Find Relevant Ones
       ↑ No personalization       ↑ High cognitive load
```

**Target (Improved)**:
```
User → Curated Feed (matched to skills) → Match Scores Visible → Quick Decision
       ↑ Personalized                      ↑ Transparency
```

---

## Action Items for Implementation

Based on this assessment, the plan should prioritize:

### Week 1.5 (Days 6-8): UX Improvements

**Day 6: Smart Defaults**
- [ ] Update `new.tsx` to default to generic form
- [ ] Add collapsible type selector
- [ ] Show type selector as "Advanced Options"
- [ ] Target: < 3 clicks for generic request

**Day 7: Feed Curation**
- [ ] Create `GET /requests/curated` endpoint
- [ ] Add match score calculation to feed
- [ ] Create MatchScoreBadge component
- [ ] Update `index.tsx` to use curated endpoint

**Day 8: Interest Subscriptions**
- [ ] Create user preferences database tables
- [ ] Add preferences API endpoints
- [ ] Build preferences settings page
- [ ] Integrate preferences into curated feed

---

## Success Criteria (UX)

After implementation, users should:

✅ **Create generic requests in < 3 clicks**
✅ **See match scores on all feed items**
✅ **Filter feed by skills/interests**
✅ **Access advanced types without friction**
✅ **Understand why requests match them**

Failure Criteria (indicators of bad UX):
❌ Users spend > 30s deciding which type to use
❌ Feed shows < 50% relevant requests
❌ Users miss requests they could help with
❌ Advanced users frustrated by type selector hiding

---

## Appendix: Code References

### Files Requiring Changes

**Posting UX**:
- `apps/frontend/src/pages/requests/new.tsx` (lines 32-181)
- `apps/frontend/src/components/requests/RequestTypeSelector.tsx`

**Feed Curation**:
- `apps/frontend/src/pages/requests/index.tsx` (lines 38-47, 135-206)
- `services/request-service/src/routes/requests.ts` (add curated endpoint)
- `apps/frontend/src/components/RequestCard.tsx` (add match score display)

**New Components Needed**:
- `apps/frontend/src/components/requests/MatchScoreBadge.tsx`
- `apps/frontend/src/components/feed/FeedFilterControls.tsx`
- `apps/frontend/src/pages/settings/preferences.tsx`

### Existing Endpoints to Leverage

- ✅ `GET /requests/matched/for-user` (exists, unused)
- ❌ `GET /requests/curated` (needs to be created)
- ❌ `GET /preferences/request-types` (needs to be created)

---

## Conclusion

The polymorphic request system is **architecturally sound** but **UX-incomplete**. The forced type selection and uncurated feed create unnecessary friction that could significantly impact user engagement.

**Bottom Line**: Without UX improvements, the "Everything App" risks overwhelming users instead of empowering them.

**Next Steps**: Proceed with Days 6-8 of the implementation plan to address these critical UX gaps before moving to Phase 2.
