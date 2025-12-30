# KarmyQ Development Roadmap

**Last Updated**: 2025-12-29
**Version**: 8.0.0
**Status**: Active Development
**Latest Session**: UI Testing & Polymorphic Data Display

---

## 🎯 Current Focus

**Primary Objective**: Ready for next priority - Choose from backlog

**Active Work Stream**: None (ADR documentation complete ✅)
**Completed**: 2025-12-29
**Next**: Review backlog and select next priority

---

## 📊 Work Streams

### 1. UI Testing Infrastructure ✅ COMPLETE

**Goal**: Comprehensive testing for web and mobile UI
**Priority**: P0 (Critical)
**Owner**: Development Team
**Started**: 2025-12-28
**Completed**: 2025-12-29

#### Status
- ✅ Mobile E2E testing framework (Maestro)
- ✅ Mobile test suite (7 smoke tests)
- ✅ Web component unit testing setup (Jest + RTL)
- ✅ Component tests (TrustPathBadge, FeedItem)
- ✅ Polymorphic renderer component + tests
- ✅ Integrated polymorphic renderer into FeedItem
- ✅ Fixed natural language parser (T-005)
- ✅ Visual verification of polymorphic data in UI

#### Completion Criteria
- [x] All dependencies installed
- [x] Polymorphic data displays correctly in UI ✅ VERIFIED
- [x] All tests passing (unit + E2E)
- [x] Visual verification of polymorphic requests ✅ VERIFIED
- [ ] Documentation updated (deferred to next session)

#### Known Issues & Future Work
- Test data quality needs improvement (polymorphic requests limited in realistic data)
- Natural language parser needs fine-tuning (added to backlog)
- Component test coverage: 2/20 components (expand in Phase 2)

---

### 2. Data Generation & Integrity ✅ COMPLETE

**Goal**: Realistic test data with proper relationships
**Priority**: P1 (High)
**Owner**: Development Team
**Status**: Complete (Previous session work)

#### Completed
- ✅ Community membership counter sync fixed
- ✅ Polymorphic request payloads generated
- ✅ Trust paths and invitation chains working
- ✅ **Realistic data generator with 200+ users, 12 communities** (Previous session)
- ✅ **714 memberships, 42 requests, 26 offers, 587 skills** (Previous session)
- ✅ **Public/private communities with varied categories/locations** (Previous session)

#### Known Issues
- ⚠️ Generated data not integrated with UI testing
- ⚠️ No automated data reset between test runs
- ⚠️ Not using fixed seed (non-deterministic)

#### Future Work
- [ ] Automated test data seeding script
- [ ] Deterministic data generator (fixed seed)
- [ ] Known test users with predictable data

---

### 3. Core Feature Development ✅ COMPLETE (Previous Session)

**Goal**: Essential platform features for user engagement
**Priority**: P0 (Critical)
**Owner**: Development Team
**Status**: Complete (Session 8e414c6e)

#### Completed Features
- ✅ **User Skills & Profile Management**
  - Database schema for user skills
  - Profile page with skills CRUD
  - Skills displayed throughout app

- ✅ **Smart Request Matching**
  - Dashboard shows requests matching user's skills
  - Prioritized display based on skill match
  - Core engagement feature

- ✅ **Community Access Control**
  - Public communities (instant join)
  - Private communities (request approval)
  - Join request workflow implemented
  - Pending approval status tracking

- ✅ **Community Discovery Enhancements**
  - Search by name/description
  - Filter by location, category, available spots
  - Sort by newest, most members, alphabetical
  - Added location and category fields to communities

- ✅ **Minimalist Dashboard Redesign**
  - Mobile-first, action-oriented design
  - Moved karma/stats to profile page
  - Focused on core actions: help others, ask for help
  - Reduced cognitive load

- ✅ **Floating Chat Widget**
  - Persistent chat button (bottom-right)
  - Expands to show conversations
  - Unread badge indicator
  - Quick access from any page

- ✅ **Enhanced Profile Page**
  - Profile information (name, bio, email)
  - Karma & reputation stats
  - My communities section
  - Skills management

- ✅ **Navigation Consistency**
  - Layout component across all pages
  - Consistent header/footer
  - Mobile-responsive

- ✅ **v1.0 Release**
  - Professional README.md
  - Setup guide
  - Architecture documentation
  - API documentation
  - Pushed to GitHub

#### Database Migrations Completed
- Added `skills` table
- Added `access_type` to communities (public/private)
- Added `location` and `category` to communities
- Added pending approval status to memberships

---

### 3. Development Process Improvements ✅ COMPLETE

**Goal**: Prevent regressions through systematic process
**Priority**: P0 (Critical)
**Owner**: Development Team
**Status**: Complete (documentation ready, needs adoption)

#### Completed
- ✅ DEVELOPMENT_PROCESS.md - Authoritative workflow guide
- ✅ DATA_FLOWS.md - Complete system data flows
- ✅ UI_TESTING_AUDIT.md - Testing framework strategy
- ✅ MOBILE_TESTING_GUIDE.md - Comprehensive mobile testing guide
- ✅ Pre-change checklists defined
- ✅ Testing requirements documented

#### Next Steps
- [ ] Team adoption and enforcement
- [ ] Integration with git hooks (optional)
- [ ] CI/CD pipeline integration

---

## 🚧 Active Tangents

### Current Tangents (Open)

| ID | Tangent | Parent Stream | Status | Priority | Blocker |
|----|---------|---------------|--------|----------|---------|
| None | - | - | - | - | - |

**Note**: All tangents from initial session have been completed. New tangents will be added here as they arise.

### Completed Tangents

| ID | Tangent | Parent Stream | Completed | Outcome |
|----|---------|---------------|-----------|---------|
| T-000 | Community membership counter sync | Data Integrity | 2025-12-28 | Fixed UPDATE query in data generator |
| T-001 | Polymorphic request rendering | UI Testing | 2025-12-28 | Built RequestPayloadRenderer + 35 tests |
| T-002 | RequestPayloadRenderer integration | T-001 | 2025-12-28 | Integrated into FeedItem component |
| T-003 | Development process documentation | Meta-process | 2025-12-28 | Created DEVELOPMENT_PROCESS.md, DATA_FLOWS.md |
| T-004 | Tangent management framework | Meta-process | 2025-12-28 | Created ROADMAP.md, TANGENT_MANAGEMENT.md |
| T-005 | Natural language parser debugging | UI Testing | 2025-12-29 | Fixed regex patterns, autocomplete display, dashboard refresh |
| T-006 | LocationPicker geocoding integration | Geocoding Infrastructure | 2025-12-29 | Replaced fake coordinates with real geocoding, added autocomplete |
| T-007 | Backend stability crisis fix | Bug Fixes | 2025-12-29 | Created missing auth.user_skills table, fixed 500 errors |
| T-008 | TODO comment tracking | Technical Debt | 2025-12-29 | Scanned 6 TODOs, created backlog items #24-27, updated all comments |
| T-009 | Architecture Decision Records (ADRs) | Documentation | 2025-12-29 | Created docs/adr/ with 15 ADRs documenting all major architectural decisions |

---

## 📋 Backlog (Loose Ends)

### High Priority (P0 - Critical)

1. **Fix Message Object Rendering Errors** - NEW FROM PREVIOUS SESSION
   - Stream: Bug Fixes
   - Issue: React crashes when message objects rendered as children instead of strings
   - Context: `{id, content, sender_id, created_at}` being rendered, not message.content
   - Status: Debugged extensively, defensive fixes added, but may still occur
   - Solution: Add proper null checks and string extraction throughout messaging components
   - Estimate: 2-3 hours
   - Blocking: Messaging feature stability
   - **Source**: Previous session (session 8e414c6e)
   - **Analysis**: See CONTEXT_LOSS_ANALYSIS.md Pattern 4

2. **Install Frontend Testing Dependencies**
   - Stream: UI Testing Infrastructure
   - Issue: Jest/RTL not installed yet
   - Action: User needs to run `npm install` in apps/frontend
   - Estimate: 5 minutes
   - Blocking: Running component tests

3. **Polymorphic Data Display Verification** - COMPLETED, NEEDS TESTING
   - Stream: UI Testing Infrastructure
   - Issue: Data exists in DB but UI doesn't show it
   - Solution: ✅ Built RequestPayloadRenderer component
   - **Status**: ✅ Integrated into FeedItem component
   - **Next**: User needs to verify it displays correctly
   - Estimate: 15 minutes (user testing)
   - Blocking: Full UI testing completion
   - **Analysis**: See CONTEXT_LOSS_ANALYSIS.md Pattern 5 (resolved)

### Medium Priority (P1 - High)

**NEW FROM CONTEXT LOSS ANALYSIS (2025-12-29)**:

1. **Complete LocationPicker Geocoding Integration** - NEW
   - Stream: Geocoding Infrastructure
   - Issue: LocationPicker uses fake coordinates, geocoding service exists but not used
   - Context: Two separate implementations (dashboard vs forms) never unified
   - Current: Random SF Bay Area coordinates in LocationPicker.tsx:39-47
   - Solution: Wire LocationPicker to geocoding.ts service
   - Features needed:
     - Import geocoding.ts functions
     - Add autocomplete dropdown
     - Remove fake coordinate generation
     - Test in RideRequestForm and EventRequestForm
   - Estimate: 2-3 hours
   - **Source**: Context loss analysis 2025-12-29
   - **Analysis**: See CONTEXT_LOSS_ANALYSIS.md Pattern 3

2. **Create Architecture Decision Records (ADRs)** - NEW
   - Stream: Documentation & Process
   - Issue: Architectural decisions not documented, context frequently lost
   - Solution: Create docs/adr/ directory with ADR template
   - Initial ADRs to write:
     - ADR-001: Natural language parsing for location input
     - ADR-002: 3-tier geocoding cache architecture
     - ADR-003: Multi-tenant RLS database design
     - ADR-004: Microservices event-driven architecture
     - ADR-005: Minimalist dashboard design
   - Estimate: 4-6 hours
   - **Source**: Context loss analysis 2025-12-29
   - **Analysis**: See CONTEXT_LOSS_ANALYSIS.md recommendations

3. **Scan and Track All TODOs** - NEW
   - Stream: Technical Debt
   - Issue: TODO comments scattered in code, never converted to backlog items
   - Found in: LocationPicker.tsx (2 TODOs), RightSidebar.tsx, LeftSidebar.tsx, dashboard.tsx
   - Solution: Automated scan + backlog creation
   - Process:
     - Run grep/ripgrep for TODO/FIXME/HACK/XXX
     - Create backlog item for each
     - Update TODO comment to reference backlog item
     - Example: `// TODO: See ROADMAP.md Backlog #42`
   - Estimate: 2-3 hours
   - **Source**: Context loss analysis 2025-12-29
   - **Analysis**: See CONTEXT_LOSS_ANALYSIS.md Pattern 4

4. **Improve Natural Language Parser Accuracy** - NEW
   - Stream: Geocoding Infrastructure
   - Issue: Parser doesn't correctly extract all location patterns
   - Examples:
     - "SFO" not recognized (only captures destination, not origin)
     - "for 2 people" not parsed to set seats_needed
     - Need more robust pattern matching for common phrases
   - Context: Basic parser works (T-005) but needs refinement
   - Solution: Expand regex patterns, add common abbreviations (SFO, JFK, LAX)
   - Testing: Add parser unit tests with edge cases
   - Estimate: 3-4 hours
   - **Status**: Deferred - core functionality works, refinement can wait
   - **User Feedback**: "Parser still needs improvement" (2025-12-29)

5. **Expand Geocoding Seed Data** - PARTIALLY COMPLETE
   - Stream: Geocoding Infrastructure
   - Issue: Only 38 locations seeded, cache ineffective for most queries
   - Context: 3-tier caching system exists but insufficient seed data
   - Current: 38 locations (expanded today from 6)
   - Target: 100+ locations (top US cities, airports, landmarks)
   - Solution: Bulk import script or manual expansion
   - Estimate: 2-3 hours
   - **Source**: Context loss analysis 2025-12-29
   - **Analysis**: See CONTEXT_LOSS_ANALYSIS.md Pattern 2
   - **Update 2025-12-29**: Natural language parser fixed (T-005), but needs fine-tuning

### Medium Priority (P1 - High) - EXISTING ITEMS

5. **Consolidate Request Forms with Enhanced NLP** - NEW
   - Stream: User Experience
   - Issue: Multiple forms (RideRequestForm, EventRequestForm, etc.) require user to pre-select type
   - Problem: Users forget to click request type before typing
   - Idea: Single unified form with smart NLP that detects request type automatically
   - Examples:
     - "Need a ride from SFO..." → auto-detect as ride request
     - "Looking for someone to help move..." → auto-detect as service request
     - "Anyone want to join me at the park..." → auto-detect as event request
   - Alternative: If NLP is overkill, explore better UX patterns (autocomplete type detection, suggested type)
   - Estimate: 6-8 hours (NLP route) or 3-4 hours (UX improvement route)
   - **Status**: Deferred - current multi-form approach works
   - **User Feedback**: "I am forgetting to click on the ride before I type a message" (2025-12-29)

6. **Admin Interface for Join Request Approvals** - NEW FROM PREVIOUS SESSION
   - Stream: Core Feature Development
   - Issue: Private communities need way to manage pending join requests
   - Context: Backend supports join requests but no admin UI exists
   - Solution: Build admin dashboard for community owners to approve/reject requests
   - Features needed:
     - View pending join requests
     - Approve/reject with one click
     - Send notifications on approval/rejection
   - Estimate: 6-8 hours
   - **Source**: Previous session (session 8e414c6e)

5. **Community Detail Page Activity Display** - NEW FROM PREVIOUS SESSION
   - Stream: Community Features
   - Issue: Community detail pages don't show current activity
   - Context: When viewing a community, users should see active requests/offers
   - Solution: Add activity feed to community detail page
   - Features:
     - Show open help requests in this community
     - Show recent offers
     - Show recent matches/completions
   - Estimate: 4-6 hours
   - **Source**: Previous session (session 8e414c6e)

6. **User Onboarding Flow** - NEW FROM PREVIOUS SESSION
   - Stream: User Experience
   - Issue: New users need guidance after registration
   - Context: Discussed in previous session but deferred for core features
   - Solution: Multi-step onboarding wizard
   - Steps:
     - Add skills/interests
     - Browse and join communities
     - View tutorial/tips
     - Create first request (optional)
   - Estimate: 8-10 hours
   - Status: Deferred from previous session
   - **Source**: Previous session (session 8e414c6e)

7. **"I Can Help" Quick Action Flow** - NEW FROM PREVIOUS SESSION
   - Stream: User Experience
   - Issue: Users need streamlined way to offer help on requests
   - Context: Three approaches discussed, decision needed
   - Options:
     - A: Navigate to request detail page
     - B: Modal to create offer inline
     - C: Auto-create match (skip offer step)
   - Estimate: 4-6 hours (depends on approach)
   - Status: Needs decision on approach
   - **Source**: Previous session (session 8e414c6e)

8. **Visual Regression Testing**
   - Stream: UI Testing Infrastructure
   - Issue: No screenshot comparison tests
   - Solution: Add Percy or Chromatic
   - Status: Planned (Phase 1, Week 1)
   - Estimate: 4-6 hours

9. **Mobile Test Coverage Expansion**
   - Stream: UI Testing Infrastructure
   - Current: 7 smoke tests
   - Target: 15-20 tests covering main features
   - Status: Planned (Phase 2)
   - Estimate: 8-12 hours

10. **Test Data Automation**
    - Stream: Data Generation & Integrity
    - Issue: Manual database reset required
    - Solution: Automated seed/truncate scripts
    - Status: Planned
    - Estimate: 3-4 hours

### Low Priority (P2 - Nice to Have)

11. **Fix TypeScript IDE Errors in Docker Environment** - NEW FROM PREVIOUS SESSION
    - Stream: Developer Experience
    - Issue: VS Code shows 40+ TypeScript module resolution errors
    - Context: Docker build works but IDE shows red squiggles everywhere
    - Impact: Annoying but doesn't block development or production
    - Solution: Fix module declarations and tsconfig paths
    - Estimate: 2-3 hours
    - **Source**: Previous session (session 8e414c6e)

12. **Docker Build Cache Optimization** - NEW FROM PREVIOUS SESSION
    - Stream: Developer Experience
    - Issue: Sometimes requires full rebuild to fix compilation errors
    - Workaround: `docker-compose down && docker-compose up --build`
    - Impact: Slow development cycle (5-10 minute rebuilds)
    - Solution: Improve Docker layer caching strategy
    - Estimate: 3-4 hours
    - **Source**: Previous session (session 8e414c6e)

13. **Component Unit Test Expansion**
    - Stream: UI Testing Infrastructure
    - Current: 2 components tested
    - Target: 20+ components
    - Status: Planned (Phase 2)
    - Estimate: 12-16 hours

14. **Performance Testing**
    - Stream: UI Testing Infrastructure
    - Issue: No load time measurements
    - Solution: Lighthouse CI integration
    - Status: Planned (Phase 3)
    - Estimate: 4-6 hours

15. **E2E Test for Polymorphic Rendering**
    - Stream: UI Testing Infrastructure
    - Issue: No end-to-end test for new feature
    - Solution: Playwright test for polymorphic display
    - Status: Planned (after integration)
    - Estimate: 2-3 hours

9. **Agent Skills Development**
   - Stream: Development Process
   - Discussion: User suggested building automated skills/agents
   - Context: Repetitive tasks could be automated
   - Solution: Build custom agent skills for common tasks
   - Status: Deferred (chose documentation-first approach)
   - Related: See Decision Log 2025-12-28
   - Estimate: 12-20 hours (significant undertaking)

10. **Git Hooks Integration**
    - Stream: Development Process
    - Issue: Tests not enforced automatically
    - Solution: Setup pre-commit/pre-push hooks
    - Script exists: `scripts/setup-git-hooks.sh`
    - Status: Optional, user decision needed
    - Estimate: 1 hour

11. **CI/CD Test Integration**
    - Stream: UI Testing Infrastructure
    - Issue: Tests not running on PRs/commits
    - Solution: GitHub Actions for all test suites
    - Example workflow in MOBILE_TESTING_GUIDE.md
    - Status: Planned (Phase 3, Week 3)
    - Estimate: 6-8 hours

12. **Responsive Design Testing**
    - Stream: UI Testing Infrastructure
    - Issue: Mobile viewport not systematically tested
    - Solution: Playwright tests with multiple viewport sizes
    - Viewports: 375px (mobile), 768px (tablet), 1280px (desktop)
    - Status: Planned (Phase 2)
    - Estimate: 4-6 hours

13. **Accessibility Testing**
    - Stream: UI Testing Infrastructure
    - Issue: No automated a11y checks
    - Solution: Add jest-axe or Playwright accessibility tests
    - Requirements: Screen reader support, keyboard nav
    - Status: Planned (Phase 3)
    - Estimate: 6-8 hours

14. **Error Boundary Testing**
    - Stream: UI Testing Infrastructure
    - Issue: Component error handling not tested
    - Gap identified in: UI_TESTING_AUDIT.md
    - Solution: Tests for error boundaries and fallback UI
    - Status: Planned (Phase 2)
    - Estimate: 2-3 hours

15. **Loading State Testing**
    - Stream: UI Testing Infrastructure
    - Issue: Loading skeletons not systematically tested
    - Gap identified in: UI_TESTING_AUDIT.md
    - Solution: Tests for all skeleton states
    - Status: Planned (Phase 2)
    - Estimate: 2-3 hours

16. **Crash Reporting Setup**
    - Stream: Mobile Testing Infrastructure
    - Issue: No crash analytics for mobile app
    - Solution: Integrate Sentry for React Native
    - Gap identified in: UI_TESTING_AUDIT.md
    - Status: Planned (Phase 3)
    - Estimate: 3-4 hours

17. **Device Farm Testing**
    - Stream: Mobile Testing Infrastructure
    - Issue: Tests only run on local simulator
    - Solution: BrowserStack or AWS Device Farm integration
    - Gap identified in: UI_TESTING_AUDIT.md
    - Status: Planned (Phase 3, Week 3)
    - Estimate: 8-10 hours

18. **Test Data Determinism**
    - Stream: Data Generation & Integrity
    - Issue: Generated data uses random seed
    - Solution: Fixed seed for reproducible test data
    - Related: Known test users with predictable IDs
    - Status: Planned
    - Estimate: 2-3 hours

19. **Snapshot Testing**
    - Stream: UI Testing Infrastructure
    - Issue: No snapshot tests for components
    - Solution: Jest snapshot tests for component output
    - Status: Planned (Phase 2)
    - Estimate: 3-4 hours

20. **Permission Testing (Mobile)**
    - Stream: Mobile Testing Infrastructure
    - Issue: Camera, location, notification permissions not tested
    - Guide exists in: MOBILE_TESTING_GUIDE.md (lines 514-554)
    - Solution: Maestro tests for all permission flows
    - Status: Planned (Phase 2)
    - Estimate: 4-6 hours

21. **Offline Mode Testing (Mobile)**
    - Stream: Mobile Testing Infrastructure
    - Issue: Offline behavior not tested
    - Guide exists in: MOBILE_TESTING_GUIDE.md (lines 556-576)
    - Solution: Maestro tests with airplane mode
    - Status: Planned (Phase 2)
    - Estimate: 4-6 hours

22. **Deep Link Testing (Mobile)**
    - Stream: Mobile Testing Infrastructure
    - Issue: Deep link navigation not tested
    - Guide exists in: MOBILE_TESTING_GUIDE.md (lines 593-601)
    - Solution: Maestro tests for karmyq:// URLs
    - Status: Planned (Phase 2)
    - Estimate: 2-3 hours

23. **Performance Monitoring**
    - Stream: UI Testing Infrastructure
    - Issue: No baseline performance metrics
    - Solutions:
      - Web: Lighthouse CI
      - Mobile: React Native Performance Monitor
    - Metrics: Load time, FPS, memory, bundle size
    - Guide exists in: MOBILE_TESTING_GUIDE.md (lines 605-638)
    - Status: Planned (Phase 3)

### Low Priority (P2 - Nice to Have) - FROM TODO SCAN 2025-12-29

24. **Re-enable Karma/Trust Score Display** - TODO #1, #2, #3
    - Files: LeftSidebar.tsx:36, RightSidebar.tsx:35, dashboard.tsx:126
    - Issue: Reputation service calls commented out with "TODO: Re-enable when reputation service auth is fixed"
    - Context: Karma/trust scores disabled, milestones disabled
    - Root Cause: Reputation service auth not working, milestone_events table missing
    - Solution:
      - Fix reputation service authentication
      - Create milestone_events and community_health_metrics tables
      - Uncomment and test all three locations
    - Estimate: 4-6 hours
    - **Status**: Deferred - not blocking core functionality
    - **Locations**:
      - LeftSidebar.tsx:36
      - RightSidebar.tsx:35
      - dashboard.tsx:126

25. **Fix Mobile API Host Configuration** - TODO #4
    - File: apps/mobile/config/api.ts:20
    - Issue: Hardcoded IP address (192.168.0.163) instead of environment variable
    - Context: Metro bundler has env var issues
    - Current: `const API_HOST = '192.168.0.163';`
    - Solution: Fix Metro bundler env var support or use alternative approach
    - Estimate: 1-2 hours
    - **Status**: Low priority - hardcoded works for development
    - **Location**: apps/mobile/config/api.ts:20

26. **Fix Feed Service Schema Mismatch** - TODO #5
    - File: services/feed-service/src/routes/feed.ts:42
    - Issue: Feed composer doesn't match actual database schema
    - Context: Currently returns empty feed to prevent crashes
    - Impact: Feed feature completely disabled
    - Solution: Update feed composer to match current schema
    - Estimate: 3-4 hours
    - **Status**: Medium priority - feed is a core feature but not critical
    - **Location**: services/feed-service/src/routes/feed.ts:42

27. **Implement Celebration Reactions** - TODO #6
    - File: services/feed-service/src/services/socialKarmaFeedComposer.ts:120
    - Issue: Celebration count hardcoded to 0
    - Context: Milestone posts need celebration/reaction feature
    - Current: `celebrationCount: 0, // TODO: Implement celebration reactions`
    - Solution: Add reactions table and API endpoints
    - Estimate: 4-6 hours
    - **Status**: Nice to have - not blocking core functionality
    - **Location**: services/feed-service/src/services/socialKarmaFeedComposer.ts:120

### Future Features (P3 - Social Architecture) - FROM ONEDRIVE PROPOSAL

**Context**: Discovered comprehensive vision documents in OneDrive Desktop folder with advanced social architecture features not yet in codebase. These align with the core philosophy of "rebuilding trust through community networks."

28. **Prestige-Based Recognition System**
    - Stream: Social Architecture
    - Source: ADR-016, OneDrive/Context/prestige_analysis.md
    - Issue: Current karma system focused on accumulation, not contribution
    - Vision: Anthropologically-inspired prestige categories (Connector, Reliable, Teacher, Catalyst, Caregiver)
    - Features:
      - Peer nomination system
      - Story-based recognition (not just points)
      - 6-month prestige half-life (like karma)
      - Prestige-weighted governance
      - "Humility Principle": high prestige = more responsibility
    - Database: reputation.prestige_categories, prestige_nominations, prestige_awards
    - Estimate: 20-30 hours
    - **Status**: Proposed (v9.0+)
    - **Philosophy**: "People are fundamentally good" - recognize contribution over accumulation

29. **Cohort-Based Community Layers**
    - Stream: Social Architecture
    - Source: ADR-017, OneDrive/Context/karmyq_comprehensive_proposal.md
    - Issue: All members treated equally, doesn't model natural social structures
    - Vision: Natural layers based on interaction frequency
      - Inner Circle (5-7): Weekly+ interactions, deep trust
      - Active Community (~50): Monthly interactions, medium trust
      - Extended Network (~150): Quarterly interactions, baseline trust
    - Implementation: Calculated from interaction history (not manual)
    - Features:
      - Layer-based notification priority
      - "Inner circle only" request option
      - Layer-weighted governance
    - Database: Computed function, no new tables
    - Estimate: 15-20 hours
    - **Status**: Proposed (v9.0+)
    - **Philosophy**: Models Dunbar's Number and natural human social organization

30. **Community Splitting Mechanics**
    - Stream: Social Architecture
    - Source: ADR-018, OneDrive/Context/karmyq_comprehensive_proposal.md
    - Issue: No mechanism for communities to gracefully split at scale limit
    - Vision: Cell division-like splitting at 130-140 members
    - Process:
      - Discussion phase (1-2 months)
      - Planning phase (member assignment, 1 month)
      - Transition phase (cross-posting, 1 month)
      - Independence phase (sister communities)
    - Features:
      - Split proposals with community voting
      - Sister community relationships (parent-child or sibling)
      - Trust transfer between sister communities (configurable %)
      - Shared history preservation
    - Database: community_relationships, split_proposals
    - Estimate: 25-35 hours
    - **Status**: Proposed (v10.0+)
    - **Philosophy**: Biological scaling - communities split like cells, not expand infinitely

31. **Referral Chain Trust System**
    - Stream: Social Architecture
    - Source: ADR-019, OneDrive/Context/karmyq_comprehensive_proposal.md
    - Issue: Open communities vulnerable to bad actors, but zero-trust creates hostile environment
    - Vision: Seed group + wave-based growth with vouching accountability
    - Model:
      - Wave 1: 5-7 founders (high trust, in-person)
      - Wave 2-4: 2-3 invites per member (exponential growth)
      - Referral requirements: 3+ months membership, 5+ exchanges, prestige threshold
    - Features:
      - Vouch statements (visible chain of trust)
      - Shared reputation during 6-month accountability period
      - Community veto for concerning referrals
      - Progressive trust for new members
    - Database: referrals, referral_flags, invitation_codes
    - Estimate: 20-25 hours
    - **Status**: Proposed (v9.0+)
    - **Philosophy**: Trust-first, not zero-trust - vouchers have skin in the game

32. **Recognition Rituals & Cultural Architecture**
    - Stream: Social Architecture
    - Source: OneDrive/Context/prestige_analysis.md, karmyq_comprehensive_proposal.md
    - Issue: Digital communities lack cultural cohesion rituals
    - Vision: Structured rituals that build community identity
    - Rituals:
      - Monthly "Gratitude Circles" (highlight contributions)
      - Annual "Legend" ceremonies (honor long-term contributors)
      - Seasonal "Skill Shares" (experts demonstrate)
      - "First Help" ceremonies (newcomer mentorship)
    - Features:
      - Event scheduling system
      - Ritual templates per community
      - Story collection and sharing
      - Cross-community ritual exchange
    - Estimate: 15-20 hours
    - **Status**: Proposed (v11.0+)
    - **Philosophy**: Shared rituals create emotional bonds (like traditional societies)

33. **Network of Networks Federation**
    - Stream: Social Architecture
    - Source: OneDrive/Context/karmyq_comprehensive_proposal.md (Part II, Section 3)
    - Issue: Individual communities limited to 150, need cross-community coordination
    - Vision: "Sister communities" maintain connections with trust bridging
    - Model:
      - Communities split when approaching 150 (Dunbar limit)
      - Sister communities share culture/norms but operate independently
      - Trust transfers between connected communities with gradual decay
      - Cross-community exchanges with trust multiplier
    - Features:
      - Community family tree visualization
      - Cross-community request posting
      - Shared tool libraries (optional)
      - Joint events and reunions
    - Related: ADR-018 (Community Splitting)
    - Estimate: 30-40 hours
    - **Status**: Proposed (v11.0+)
    - **Philosophy**: Scale through federation, not centralization

---

## 🗓️ Timeline

### Immediate (Today)
1. ✅ Mobile testing framework setup
2. ✅ Web component unit testing setup
3. ✅ Polymorphic renderer component
4. 🔄 **CURRENT**: Integrate polymorphic renderer
5. ⏭️ **NEXT**: Install dependencies and verify tests pass

### This Week (Week of 2025-12-28)
1. Complete UI testing infrastructure (Phase 1)
2. Visual regression tests for 5-10 critical screens
3. Manual testing of polymorphic data display
4. Update E2E tests for new features

### Next Week
1. Expand mobile test coverage (Phase 2)
2. Add component unit tests for 10+ components
3. Automated test data seeding
4. Performance baseline measurements

### Month 1 (January 2025)
1. CI/CD integration for all tests
2. Visual regression in PR pipeline
3. Mobile device farm setup
4. Performance monitoring dashboard

---

## 💡 Ideas & Discussions (Not Yet Planned)

This section captures ideas discussed but not yet prioritized or scoped.

### Process Improvements

1. **Custom AI Agent Skills**
   - **Discussion**: Build automated agents for repetitive tasks
   - **Context**: User suggested focusing on agent skills vs manual process
   - **Decision**: Started with documentation-first (Option C)
   - **Future**: Could build skills after process is well-documented
   - **Examples**: Auto code review, test generation, refactoring agents
   - **Status**: On hold pending process adoption

2. **Automated Code Review Agent**
   - **Idea**: Agent that reviews code for common issues
   - **Checks**: Security vulnerabilities, type safety, test coverage
   - **Trigger**: Pre-commit or PR creation
   - **Status**: Deferred to agent skills work

### Testing Enhancements

3. **Visual Regression Service Selection**
   - **Options Discussed**: Percy vs Chromatic
   - **Decision Pending**: Need to evaluate cost and features
   - **Priority**: P1 (needed for Phase 1)

4. **Test Data Factory Pattern**
   - **Idea**: Builder pattern for creating test data
   - **Benefits**: More readable tests, easier maintenance
   - **Example**: `TestUser.create().withKarma(100).inCommunity('Columbus')`
   - **Status**: Consider for Phase 2

5. **Contract Testing**
   - **Idea**: Test API contracts between services
   - **Tool**: Pact or similar
   - **Benefits**: Catch breaking changes between microservices
   - **Status**: Consider for future

### UI/UX Improvements

6. **Polymorphic Request Detail Pages**
   - **Context**: Built renderer for feed, but detail pages also need it
   - **Scope**: Request detail page, offer flow, match screen
   - **Status**: After feed integration verified

7. **Trust Path Visualization**
   - **Idea**: Visual graph showing connection path
   - **Current**: Text-based "You → Alice → Bob"
   - **Enhancement**: Interactive graph with profile pictures
   - **Status**: Nice to have, P2

8. **Mobile-Specific UI Patterns**
   - **Discussion**: Some patterns might be better on mobile
   - **Examples**: Swipe actions, bottom sheets, floating action buttons
   - **Status**: Consider during mobile development

### Data & Analytics

9. **Test Data Snapshots**
   - **Idea**: Save/restore database state for testing
   - **Benefits**: Faster test setup, consistent state
   - **Tools**: pg_dump snapshots
   - **Status**: Consider if test data becomes complex

10. **Analytics Dashboard**
    - **Idea**: Track test metrics over time
    - **Metrics**: Test count, coverage %, run time, flakiness
    - **Tools**: Could use Grafana
    - **Status**: Nice to have after tests stabilize

### Documentation

11. **Video Walkthroughs**
    - **Idea**: Screen recordings of test setup and execution
    - **Audience**: New developers, onboarding
    - **Tools**: Loom or similar
    - **Status**: After process stabilizes

12. **Architecture Decision Records (ADRs)**
    - **Idea**: Document why decisions were made
    - **Format**: Markdown files in docs/adr/
    - **Benefits**: Future context for changes
    - **Status**: Could start now, lightweight

---

## 🎬 Decision Log

### 2025-12-28: Process Documentation vs Agent Skills

**Decision**: Documentation-first approach (Option C)
**Options Considered**:
- Option A: Manual testing first
- Option B: Build automated agent skills
- Option C: Document process, then build skills

**Rationale**:
- Process must be understood before automating
- Documentation serves as single source of truth
- Skills can be built later based on documented process
- Immediate value from process docs

**Impact**: Created 4 major process documents as foundation
**Next Steps**: Adopt process, then consider automation

---

### 2025-12-28: Mobile Testing Framework Selection

**Decision**: Use Maestro instead of Detox
**Rationale**:
- Simpler syntax and setup
- Cross-platform (iOS/Android/Web)
- Better CI/CD integration
- Can add Detox later if needed

**Impact**: Faster initial setup, easier maintenance

---

### 2025-12-28: Testing-First Approach for Polymorphic Rendering

**Decision**: Build component with tests before integrating
**Rationale**:
- TDD approach ensures correct behavior
- Tests document expected functionality
- Easier to debug integration issues

**Impact**: Component is fully tested but not yet visible in UI

**Learning**: Should have integrated immediately to close the loop

---

### Previous Session (8e414c6e): Dashboard Design Philosophy

**Decision**: Minimalist, action-focused dashboard
**Options Considered**:
- Expansive dashboard with all info
- Minimalist dashboard (chosen)

**Rationale**:
- Mobile-first design requires simplicity
- Reduce cognitive load for users
- Focus on core actions: help others, ask for help
- Move stats/karma to profile page where they belong

**Impact**:
- Dashboard only shows: matched requests, ask-for-help button, active requests
- Profile page became hub for info (karma, communities, skills)
- Cleaner, more focused UX

**User Feedback**: Positive, preferred compact design

---

### Previous Session (8e414c6e): Community Join Flow

**Decision**: Public communities = instant join, Private communities = request/approval

**Rationale**:
- Different communities have different membership requirements
- Public communities want growth, no barriers
- Private communities need quality control
- Implemented via `access_type` field (public/private)

**Impact**:
- Added join request workflow
- Added pending approval status
- Community owners can approve/reject
- Flexible system supports both models

**Database Changes**:
- Added `access_type` column to communities
- Added `status` column to memberships (active/pending)

---

### Previous Session (8e414c6e): Realistic vs. Minimal Test Data

**Decision**: Generate realistic, varied test data (200+ users, 12 communities)

**Rationale**:
- Minimal data doesn't expose edge cases
- Realistic data makes demo more convincing
- Varied data (locations, categories, skills) tests filtering/search
- Helps identify UI/UX issues

**Impact**:
- Created comprehensive data generator
- 203 users, 12 communities, 714 memberships
- 42 requests, 26 offers, 587 skills
- Realistic names, varied community types
- Uncovered several UI bugs through testing

**Trade-off**: Non-deterministic (random seed), harder to reproduce specific scenarios

---

### Current Session (2025-12-29): Natural Language Parsing for Location Input

**Decision**: Use natural language parsing (`"from SFO to SJC"`) instead of requiring `@` symbols

**Rationale**:
- Better UX - more intuitive for users
- Less training required
- Natural way to express locations
- `@` symbols were just a test mechanism

**Implementation**:
- Parser detects `"from X"` and `"to Y"` patterns (dashboard.tsx:328-365)
- Triggers geocoding service automatically
- Position tracking added to prevent replacement bugs
- Works alongside `@` symbol fallback

**Impact**:
- Users can type naturally: `"from SFO to SJC tomorrow"`
- Autocomplete appears without special syntax
- More accessible interface

**Context Lost Previously**: Decision was made but not documented, leading to confusion about whether `@` symbols were the primary interface

---

### Current Session (2025-12-29): 3-Tier Geocoding Cache Architecture

**Decision**: Implement multi-tier caching to reduce external Nominatim API calls

**Rationale**:
- Nominatim API has latency issues (~500ms+)
- Rate limiting (1 req/sec) causes delays
- Common locations queried repeatedly
- Shared cache benefits all users

**Implementation**:
- **Tier 1**: IndexedDB common locations (instant, ~5ms) - geocodingCache.ts
- **Tier 2**: Backend PostgreSQL cache at port 3009 (fast, ~50ms) - geocoding-service
- **Tier 3**: localStorage cache (instant, ~5ms) - geocoding.ts
- **Tier 4**: Direct Nominatim API (slow, fallback only)

**Impact**:
- 90%+ cache hit rate for common locations (after seed data expansion)
- Faster autocomplete response
- Reduced external API dependency
- Better offline capability (IndexedDB + localStorage)

**Context Lost Previously**: System was built but purpose and architecture not documented, insufficient seed data made it ineffective

---

### Current Session (2025-12-29): Architecture Decision Records (ADRs)

**Decision**: Adopt ADRs in `docs/adr/` directory for all non-trivial architectural decisions

**Options Considered**:
- A: Continue with decision log in ROADMAP.md only
- B: Create separate ADR documents (chosen)
- C: Use inline code comments

**Rationale**:
- Dedicated files more discoverable than ROADMAP entries
- Template format ensures completeness
- Industry standard practice
- Git history tracks evolution
- Can link from code and docs

**Impact**:
- Better architectural transparency
- Easier onboarding for new developers
- Prevents repeating past mistakes
- Requires discipline to maintain

**Implementation**:
- Create docs/adr/ directory
- Create ADR template (numbered, dated)
- Document 5 initial decisions (see CONTEXT_LOSS_ANALYSIS.md)
- Reference ADRs from CLAUDE.md

---

### Current Session (2025-12-29): TODO Comment Tracking Process

**Decision**: Systematic tracking of all TODO comments with backlog references

**Process Established**:
1. **Scan for TODOs**: Use grep to find all TODO/FIXME/HACK/XXX comments
   ```bash
   grep -rn "TODO\|FIXME\|HACK\|XXX" --include="*.ts" --include="*.tsx" \
     --exclude-dir=node_modules --exclude-dir=dist apps/ services/ packages/
   ```
2. **Create Backlog Items**: Add each TODO as a backlog item in ROADMAP.md with:
   - File location and line number
   - Clear issue description
   - Context about why it was deferred
   - Estimated effort
   - Priority level
3. **Update TODO Comments**: Add backlog reference to each TODO
   - Format: `// TODO: [description] (See ROADMAP.md Backlog #XX)`
   - Example: `// TODO: Re-enable when auth fixed (See ROADMAP.md Backlog #24)`
4. **Periodic Review**: Monthly scan to catch new TODOs

**Impact**:
- 6 TODOs found in initial scan (2025-12-29)
- All tracked as Backlog items #24-27
- All TODO comments updated with backlog references
- Clear visibility into deferred work
- Prevents forgotten technical debt

**Results of First Scan**:
- **#24**: Re-enable Karma/Trust Score Display (3 locations)
- **#25**: Fix Mobile API Host Configuration
- **#26**: Fix Feed Service Schema Mismatch
- **#27**: Implement Celebration Reactions

---

## 🔄 Return to Main Path Protocol

When a tangent is identified:

1. **Document the tangent** in "Active Tangents" table
2. **Link to parent stream** to maintain context
3. **Set clear completion criteria** for the tangent
4. **Define "return path"** - what happens when tangent is complete
5. **Update main stream status** to reflect tangent

When tangent is complete:

1. **Move to "Completed Tangents"** table
2. **Update parent stream** with tangent outcome
3. **Resume parent stream** at documented return point
4. **Verify completion criteria** of parent stream

---

## 📝 How to Use This Document

### For Daily Development

1. Check **Current Focus** - What's the main goal?
2. Review **Active Tangents** - Am I on track or diverted?
3. Update **Status** - Mark progress on current work
4. Check **Backlog** - What's next after current task?

### When Starting a Tangent

1. Add to **Active Tangents** table with:
   - Clear description
   - Parent stream link
   - Priority level
   - Any blockers
2. Set clear **completion criteria**
3. Document **return path** to main work

### When Completing Work

1. Move from Active → Completed
2. Update parent stream status
3. Check if any blockers cleared
4. Pick next item from Backlog

### Weekly Review

1. Review all Active Tangents
2. Close or re-prioritize stale tangents
3. Update Timeline estimates
4. Move completed work to Completed section

---

## 🚨 Emergency Brake

If you feel lost or have too many open tangents:

1. **STOP** - Don't start new work
2. **REVIEW** - Read "Current Focus" and "Active Tangents"
3. **CHOOSE** - Pick ONE tangent to close
4. **COMPLETE** - Finish that tangent or document why you can't
5. **RETURN** - Go back to main path

**Rule**: No more than 3 active tangents at once

---

## 📚 Related Documentation

- [DEVELOPMENT_PROCESS.md](DEVELOPMENT_PROCESS.md) - How to make changes safely
- [DATA_FLOWS.md](architecture/DATA_FLOWS.md) - How data flows through the system
- [CONTEXT_LOSS_ANALYSIS.md](CONTEXT_LOSS_ANALYSIS.md) - ✨ **NEW**: Context loss patterns and prevention (2025-12-29)
- [UI_TESTING_AUDIT.md](testing/UI_TESTING_AUDIT.md) - Testing strategy and gaps
- [MOBILE_TESTING_GUIDE.md](testing/MOBILE_TESTING_GUIDE.md) - Mobile testing reference
- [PROJECT_STATUS.md](PROJECT_STATUS.md) - Overall project status
- [ARCHITECTURE.md](architecture/ARCHITECTURE.md) - System architecture

---

## 🎯 Success Metrics

### UI Testing Infrastructure
- ✅ Mobile: 7/7 smoke tests passing
- ⏳ Web: 2/20 component tests created
- ⏳ Visual: 0/10 critical screens tested
- ⏳ E2E: 11/11 Playwright tests passing (existing)

### Data Quality
- ✅ Community counters: 600/600 synced
- ✅ Polymorphic payloads: Generated
- ⏳ UI display: 0% (not integrated)

### Process Adoption
- ✅ Documentation: 100% (4 major docs created)
- ⏳ Team usage: 0% (not yet enforced)
- ⏳ Git hooks: 0% (optional, not set up)

---

**Remember**: The goal is not to avoid tangents - they're necessary and often uncover important issues. The goal is to **track them** and **return to the main path** systematically.

---

## 🔍 Session Learning & Evolution

This section tracks how our understanding evolved during development sessions.

### Session 2025-12-28: Initial UI Testing Setup

**Started With**: "Test the UI"

**What We Discovered**:
1. Mobile has NO testing infrastructure
2. Web has E2E tests but no component unit tests
3. Polymorphic request data exists but UI doesn't show it
4. Community membership counters were out of sync
5. Development process causes regressions due to lack of systematic approach
6. Tangents are natural but need tracking framework

**How Scope Evolved**:
```
Original Request: "Test the UI"
  ↓
Discovery 1: Need both web AND mobile testing
  ↓
Discovery 2: Missing polymorphic data display
  ↓
Tangent 1: Build RequestPayloadRenderer component
  ↓
Discovery 3: Too many tangents, losing track
  ↓
Tangent 2: Build tangent management framework
  ↓
Final Scope: UI testing + polymorphic rendering + process framework
```

**Completed**:
- Mobile: Maestro framework + 7 tests
- Web: Jest/RTL setup + 81 tests
- Polymorphic: Renderer component + integration
- Process: ROADMAP.md + TANGENT_MANAGEMENT.md + DEVELOPMENT_PROCESS.md + DATA_FLOWS.md

**Key Insight**: What seemed like a simple "test the UI" request uncovered fundamental gaps in testing infrastructure AND process management. Each discovery was valuable, but without tracking, we'd have lost the big picture.

**Lessons**:
1. ✅ Start with roadmap check - would have shown UI testing as current focus
2. ✅ Document tangents immediately - would have kept all ideas tracked
3. ✅ Complete before starting new - would have integrated renderer sooner
4. ✅ Use backlog for discovered work - would have captured all 23 items
5. ✅ Return to main path - would have verified UI actually works

**What's Still Pending**:
- Dependencies installation (user action)
- Test verification (pending dependencies)
- Visual UI confirmation (pending dependencies)
- CI/CD integration (planned)

---

## 📝 How to Maintain This Document

### Daily
- [ ] Update "Current Focus" if priorities change
- [ ] Add new tangents to "Active Tangents" table
- [ ] Move completed work to "Completed Tangents"
- [ ] Add discovered work to Backlog

### Weekly
- [ ] Review Active Tangents - close or re-prioritize
- [ ] Review Backlog - update estimates and priorities
- [ ] Update Timeline based on actual progress
- [ ] Clean up stale items

### Monthly
- [ ] Review Work Streams - are they still relevant?
- [ ] Review Ideas & Discussions - promote to Backlog if needed
- [ ] Update Success Metrics
- [ ] Archive completed work

### When Starting New Work
1. Check "Current Focus" - is this aligned?
2. If not aligned, is this a tangent? Document it!
3. Check Backlog - is this already captured?
4. Update Active Tangents table if starting tangent

### When Completing Work
1. Move from Active → Completed
2. Update parent stream status
3. Add any new discoveries to Backlog
4. Update Success Metrics

---

**Remember**: The goal is not to avoid tangents - they're necessary and often uncover important issues. The goal is to **track them** and **return to the main path** systematically.
