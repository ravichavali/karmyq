# KarmyQ Development Roadmap

**Last Updated**: 2025-12-30
**Version**: 8.0.0
**Status**: Active Development
**Latest Session**: Social Graph UI Implementation

---

## 🎯 Current Focus

**Primary Objective**: Test Fixing & Feature Implementation

**Active Work Stream**: Integration Test Fixes (Phase 1 Complete ✅)
**Completed**: 2025-12-29 - Phase 1 (API response format, TypeScript errors)
**Next**: Phase 2 - Implement missing API endpoints or skip unimplemented features

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

*No active tangents - ready for next work stream*

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
| T-010 | Integration Test Fixes Phase 1 | Testing Infrastructure | 2025-12-29 | Fixed API response format, TypeScript errors, documented missing features |
| T-011 | Social Graph UI Implementation | Social Features | 2025-12-30 | Created invite acceptance page, trust path badges, invitation chain, ADR-021 |

---

## 📋 Backlog (Loose Ends)

### High Priority (P0 - Critical)

1. **Fix Failing Integration Tests** - 🎯 PHASE 1 COMPLETE
   - Stream: Testing Infrastructure
   - Issue: 22/149 integration tests failing (85.2% passing)
   - **Phase 1 Complete** (2025-12-29):
     - ✅ Fixed API response format checks (6 files)
     - ✅ Fixed TypeScript compilation errors (2 files)
     - ✅ Documented findings in PHASE_1_RESULTS.md
   - **Key Finding**: Most failing tests are CORRECT - they reveal missing API features
   - **Remaining Issues** (11 tests):
     - 3 tests: Community-service endpoints don't exist (ADR-009/011)
     - 1 test: Request-service doesn't set expires_at
     - 12 tests: Social-graph authentication issues
   - **Phase 2 Options**:
     - Option A: Implement missing endpoints (8-12 hours)
     - Option B: Skip tests until features implemented (.skip)
     - Option C: Continue down backlog, implement endpoints later
   - **Status**: Awaiting user decision on Phase 2 approach
   - **User Request**: "I like to continue down the backlog, but with fixing the tests first"

2. **Test Data Determinism & Time Travel** - HIGH PRIORITY
   - Stream: Data Generation & Integrity
   - Issue: Can't test time-based features (karma decay, ephemeral data, trust growth)
   - Problems:
     - Data generation scripts create "now" timestamps only
     - Integration tests can't simulate 6-month-old karma
     - Ephemeral data tests need expired records to verify cleanup
     - No way to test reputation decay over time
   - Solution:
     - Add "backdated" test data factories
     - Support creating records with custom timestamps
     - Test helpers: `createBackdatedKarma(monthsAgo)`, `createExpiredRequest(daysAgo)`
   - Examples:
     ```typescript
     // Create karma from 6 months ago to test decay
     await createBackdatedKarma(userId, communityId, { monthsAgo: 6, points: 100 });

     // Create expired request to test cleanup
     await createExpiredRequest(communityId, { daysAgo: 65 });
     ```
   - Estimate: 8-12 hours
   - **Status**: P0 - Blocking ephemeral data and reputation testing
   - **User Feedback**: "We need to figure out how to mock year old data"

3. **Consolidate Data Generation Scripts** - HIGH PRIORITY
   - Stream: Data Generation & Integrity
   - Issue: 5+ different scripts creating data inconsistently
   - Current scripts causing conflicts:
     - seed-test-data.js (old approach)
     - generate-realistic-data.ts (new, most complete)
     - populate-polymorphic-data.js (specific use case)
     - create-test-feed-data.js (deprecated?)
     - generate-large-dataset.js (performance testing)
   - Solution: Single source of truth
     - Keep: generate-realistic-data.ts as master script
     - Archive or refactor others to call generate-realistic-data
     - Add CLI flags: --fresh, --aged, --large, --polymorphic
   - Estimate: 4-6 hours
   - **Status**: P0 - Causing "weird inconsistencies"
   - **User Feedback**: "The data load via data scripts seems to be causing some weird inconsistencies"

4. **Parallel Development Infrastructure** - 🆙 MOVED UP
   - Stream: Developer Experience
   - Issue: Need support for multiple developers (Antigravity IDE + Gemini models)
   - Problems:
     - Database migrations: Multiple devs changing schema → conflicts
     - Shared package changes: Affect all services simultaneously
     - Integration test conflicts: Tests hit same database
   - Solution:
     - Migration versioning system (Flyway or Knex migrations)
     - Separate test databases per developer/CI runner
     - Shared package change notification system
     - Developer environment isolation (Docker Compose override files)
   - Estimate: 8-12 hours
   - **Status**: P0 - User wants parallel development
   - **User Request**: "I also want to run parallel development using antigravity ide and some gemini models"

5. **Fix Message Object Rendering Errors** - FROM PREVIOUS SESSION
   - Stream: Bug Fixes
   - Issue: React crashes when message objects rendered as children instead of strings
   - Context: `{id, content, sender_id, created_at}` being rendered, not message.content
   - Status: Debugged extensively, defensive fixes added, but may still occur
   - Solution: Add proper null checks and string extraction throughout messaging components
   - Estimate: 2-3 hours
   - Blocking: Messaging feature stability
   - **Source**: Previous session (session 8e414c6e)

6. **Install Frontend Testing Dependencies**
   - Stream: UI Testing Infrastructure
   - Issue: Jest/RTL not installed yet
   - Action: User needs to run `npm install` in apps/frontend
   - Estimate: 5 minutes
   - Blocking: Running component tests

7. **Polymorphic Data Display Verification** - COMPLETED, NEEDS TESTING
   - Stream: UI Testing Infrastructure
   - Issue: Data exists in DB but UI doesn't show it
   - Solution: ✅ Built RequestPayloadRenderer component
   - **Status**: ✅ Integrated into FeedItem component
   - **Next**: User needs to verify it displays correctly
   - Estimate: 15 minutes (user testing)
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

### DevOps & Infrastructure (P2 - Important)

38. **Multi-Environment Deployment Strategy**
    - Stream: DevOps & Infrastructure
    - Requirements:
      - Dev environment: Laptop (local development)
      - Staging environment: Linux box (testing before production)
      - Production environment: Oracle Cloud Infrastructure (OCI) free tier
    - Domain: karmyq.com (registered via Namecheap)
    - Goals:
      - Configure karmyq.com → OCI production
      - CI/CD pipeline for dev → staging → production
      - Environment-specific configs (.env files)
    - Considerations:
      - Kubernetes for scaling (multi-instance services)
      - Service mesh for microservices communication
      - Database migrations across environments
      - SSL/TLS certificates (Let's Encrypt)
    - Status: **User Priority** - Needs planning
    - Estimate: 20-30 hours
    - Related: See ADR-021 (to be created)

39. **Documentation Migration to GitHub Wiki**
    - Stream: Documentation
    - Issue: Docs currently in `/docs` folder
    - Goal: Move all documentation to GitHub Wiki
    - Benefits:
      - Better discoverability
      - Community contributions easier
      - Versioning via Git
      - Integrated with GitHub
    - Migration Plan:
      - Audit current docs structure
      - Create wiki page hierarchy
      - Migrate content (preserve links)
      - Update README with wiki links
    - Status: **User Priority** - Needs planning
    - Estimate: 8-12 hours

40. **Kubernetes Architecture for Scaling**
    - Stream: DevOps & Infrastructure
    - Issue: Current Docker Compose not production-ready
    - Goal: K8s manifests for horizontal scaling
    - Requirements:
      - Helm charts for each service
      - Service mesh (Istio or Linkerd)
      - Auto-scaling based on load
      - Rolling updates with zero downtime
      - StatefulSets for databases
    - Considerations:
      - OCI Kubernetes Engine (OKE) compatibility
      - Resource limits for free tier
      - Multi-instance service coordination (Redis Pub/Sub)
    - Status: **User Priority** - Needs ADR
    - Estimate: 30-40 hours
    - Related: See ADR-022 (to be created)

41. **Social Graph UI Pages** - ✅ COMPLETE (2025-12-30)
    - Stream: Frontend Features
    - Issue: Social graph backend complete, no UI
    - Goal: Create UI for invitation system and trust path visualization
    - Completed Features:
      - ✅ `/invite/[code]` - Public invitation acceptance with signup (310 lines)
      - ✅ Dashboard: Trust path badges on offers (OfferItem component)
      - ✅ User profile: Invitation chain showing ancestry
      - ✅ Public validation endpoint (no auth required)
    - Components Created:
      - ✅ InvitationChain.tsx (152 lines) - Gradient design with avatars
      - ✅ useInvitationChain.ts (72 lines) - Custom hook for API calls
      - ✅ OfferItem.tsx (107 lines) - Fixed React hooks violation
      - ✅ /invite/[code].tsx (310 lines) - Complete signup flow
    - Backend Fixes:
      - ✅ Added CORS middleware to social-graph-service
      - ✅ Moved validation endpoint before authMiddleware (public access)
      - ✅ Fixed schema reference (communities.communities)
    - Frontend Fixes:
      - ✅ Fixed React hooks violation (useTrustPath in map)
      - ✅ Type narrowing for router.query (TypeScript fix)
    - Related ADR: ADR-021 (Trust Path Filtering)
    - Tangent: T-011 (Social Graph UI Implementation)
    - Remaining Work (Future Backlog):
      - Trust path graph visualization (D3.js - Item #45)
      - `/dashboard/invitations` page (invitation management - nice-to-have)
    - Time Spent: ~6 hours
    - Status: **Complete** - Core features implemented and tested

42. **Expo SDK Upgrade**
    - Stream: Mobile Infrastructure
    - Issue: Stuck on older Expo version due to React compatibility bug
    - Current: Expo SDK version needs verification
    - Goal: Upgrade to latest stable Expo SDK
    - Blockers:
      - React version incompatibility
      - Breaking changes in newer Expo versions
    - Tasks:
      - Research current Expo/React compatibility matrix
      - Identify which Expo version we're on
      - Test upgrade path in separate branch
      - Update all Expo-dependent packages
      - Test on iOS and Android
    - Status: Blocked - Needs investigation
    - Estimate: 4-8 hours (depending on breaking changes)
    - Priority: Medium (technical debt)

43. **Trust Path Filtering (Static Preferences)**
    - Stream: Feed Features
    - Issue: No control over how many degrees of separation users see in feeds
    - Context: As communities grow, feeds become overwhelming; users need control
    - Goal: Allow communities and users to configure trust path filtering
    - Features:
      - Community default setting (1-6 degrees, default: 3)
      - User preference override slider
      - Feed API filters by `trust_path.degrees <= user_preference`
      - Settings UI in profile and community admin
      - Badge on feed items showing degree number (e.g., "2° connection")
    - Technical Details:
      - Add `default_trust_path_filter` to `community.communities` table
      - Add `trust_path_filter_preference` to `auth.user_preferences` table
      - Modify Feed API query to filter trust paths by preference
      - Update TrustPathBadge to show degree number prominently
    - Database Schema:
      ```sql
      ALTER TABLE community.communities
      ADD COLUMN default_trust_path_filter INTEGER DEFAULT 3 CHECK (default_trust_path_filter BETWEEN 1 AND 6);

      ALTER TABLE auth.user_preferences
      ADD COLUMN trust_path_filter_preference INTEGER CHECK (trust_path_filter_preference BETWEEN 1 AND 6);
      -- NULL means use community default
      ```
    - API Changes:
      - `GET /feed/requests?trust_filter=true` (respects user preference)
      - `GET/PATCH /communities/:id/settings` (admin sets default)
      - `GET/PATCH /users/me/preferences` (user override)
    - User Stories:
      - "As a user, I want to control how far out in my trust network I see requests"
      - "As an admin, I want to set a sensible default for my community"
      - "As a cautious helper, I only want to see requests from close connections (1-2 degrees)"
    - Acceptance Criteria:
      - Admin can set community default (1-6)
      - Users can override with personal preference
      - Feed respects filters (doesn't show requests beyond threshold)
      - Clear UI indication of current filter setting
      - Trust path badges show degree number
    - Status: **Planned** - Implement after social graph UI is complete
    - Estimate: 4-6 hours
    - Priority: High (post-social-graph-UI)
    - Related: ADR-021 (Trust Path Filtering), Social Graph Service (Port 3010)
    - Dependencies: Social graph UI must be complete and tested

44. **Adaptive Trust Ladder (Behavioral Nudging)**
    - Stream: Reputation & Engagement
    - Issue: Users start cautious and never expand; need intelligent growth
    - Context: Static filtering helps, but users need guidance on when to trust more/less
    - Goal: Intelligently nudge users to adjust trust settings based on interaction history
    - Features:
      - Track interaction outcomes (matches completed, abandoned, rated)
      - Calculate "trust comfort score" based on history
      - After 5 successful exchanges → nudge to expand by 1 degree
      - After 2 negative experiences → suggest contracting by 1 degree
      - Non-intrusive notifications (max once per month)
      - User can dismiss, accept, or opt-out entirely
      - A/B test nudge effectiveness
    - Technical Details:
      - Add `interaction_outcomes` tracking table
      - Add `trust_comfort_score` JSONB field to `auth.users`
      - Background job (daily cron) calculates trust comfort scores
      - Notification service sends nudges via user preferences
      - Analytics track nudge acceptance rate and effectiveness
    - Database Schema:
      ```sql
      CREATE TABLE reputation.interaction_outcomes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES auth.users(id),
        community_id UUID REFERENCES community.communities(id),
        match_id UUID REFERENCES requests.matches(id),
        outcome VARCHAR(50) CHECK (outcome IN ('completed', 'abandoned', 'rated_positive', 'rated_negative')),
        trust_path_degree INTEGER,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      ALTER TABLE auth.users
      ADD COLUMN trust_comfort_score JSONB DEFAULT '{"current_level": 3, "successful_exchanges": 0, "negative_exchanges": 0, "last_nudge_at": null}'::jsonb;
      ```
    - Nudge Examples:
      - Expand: "You've had 5 great exchanges! Would you like to help people 3 degrees away?"
      - Contract: "We noticed some recent challenges. Want to focus on closer connections for now?"
    - Privacy Considerations:
      - Don't store detailed negative interaction data (just counts)
      - Users can opt out of nudging entirely
      - Transparent about why nudge is happening (show trust score breakdown)
      - GDPR compliant (users can request deletion)
    - User Stories:
      - "As a new user, I want the system to help me gradually expand my comfort zone"
      - "As an experienced user, I want feedback if my trust level doesn't match my experiences"
      - "As a privacy-conscious user, I want to opt out of behavioral nudging"
    - Acceptance Criteria:
      - System tracks interaction outcomes without storing PII
      - Nudges sent at appropriate times (not spammy)
      - Users can accept, dismiss, or opt-out
      - Analytics show nudge effectiveness (A/B test)
      - Privacy policy updated to reflect tracking
    - Status: **Planned** - Implement after launch (requires user base)
    - Estimate: 12-20 hours
    - Priority: Medium (post-launch feature)
    - Related: ADR-021 (Trust Path Filtering), Reputation Service (Port 3004)
    - Dependencies:
      - Item #43 (Static Filtering) must be complete
      - Requires established user base for meaningful data
      - Notification service must support nudge templates

45. **Trust Paths Based on Interactions (Not Invitations)**
    - Stream: Social Graph Features
    - Issue: Current trust path uses invitation chain (static), not interaction graph (dynamic)
    - Context: Trust paths should show "who vouches for this person" based on completed exchanges
    - Current Implementation:
      - Uses `auth.user_invitations` table (invitation chain)
      - Shows path A invited B, B invited C (static, never changes)
      - Same path in both directions (symmetric)
    - Correct Implementation:
      - Use `requests.matches` table (completed interactions)
      - Show path A helped C, B helped C (dynamic, based on karma)
      - Different paths per direction (asymmetric: Trust(A→B) ≠ Trust(B→A))
      - Moderator fallback when no mutual interactions exist
    - Goal: Rewrite trust path computation to use interaction graph
    - Features:
      - **Direct Interaction** (Degree 0): A and B completed match together
      - **Mutual Helper** (Degree 2): A and B both helped/were helped by C
      - **Moderator Bridge** (Degree 2): Fallback when no mutual helpers
      - **Extended Network** (Degree 3+): BFS through interaction graph
      - **Asymmetric Paths**: Path A→B ≠ Path B→A
      - **Trust Scoring**: Weight edges by karma + ratings
    - Technical Details:
      - Create `reputation.interaction_graph` materialized view
      - Rewrite `services/social-graph-service/src/services/pathComputation.ts`
      - Update cache structure to include direction
      - Add moderator fallback logic
      - Optimize with indexes and batch queries
    - Database Schema:
      ```sql
      -- Materialized view for fast interaction lookups
      CREATE MATERIALIZED VIEW reputation.interaction_graph AS
      SELECT
        hr.requester_id as user_a,
        m.responder_id as user_b,
        hr.community_id,
        COUNT(*) as interaction_count,
        SUM(kr.points) as total_karma,
        AVG(CASE WHEN kr.event_type = 'match_completed' THEN kr.points ELSE 0 END) as avg_rating,
        MAX(m.completed_at) as last_interaction
      FROM requests.matches m
      JOIN requests.help_requests hr ON m.request_id = hr.id
      LEFT JOIN reputation.karma_records kr ON kr.match_id = m.id
      WHERE m.status = 'completed'
      GROUP BY hr.requester_id, m.responder_id, hr.community_id;

      -- Asymmetric trust path cache
      CREATE TABLE reputation.trust_paths (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_user_id UUID NOT NULL,  -- Person viewing
        target_user_id UUID NOT NULL,  -- Person being viewed
        community_id UUID NOT NULL,
        degrees INTEGER NOT NULL,
        path_user_ids UUID[] NOT NULL,  -- Array of user IDs in path
        bridge_user_id UUID,            -- The key person connecting them
        bridge_user_name TEXT,
        trust_score INTEGER,
        computed_at TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
        UNIQUE(source_user_id, target_user_id, community_id)
      );
      ```
    - UI Changes:
      - Update `TrustPathBadge` to show bridge person
      - Example: "2° via Carol who you both helped"
      - Different colors based on trust score
      - Distinguish moderator bridges: "2° via Moderator Alice"
    - Algorithm Pseudocode:
      ```typescript
      1. Check direct interaction (degree 0)
      2. Find mutual helpers with highest combined trust
      3. Fallback to moderator as bridge
      4. Extended BFS for degrees 3+ (limited)
      5. Cache with direction (A→B separate from B→A)
      ```
    - User Stories:
      - "As a user viewing a request, I want to know who can vouch for this person based on real interactions"
      - "As a requester, I want to see helpers who are trusted by people I've actually helped"
      - "As a cautious user, I want to know if someone is only connected via moderator (weaker trust)"
    - Acceptance Criteria:
      - Trust paths based on completed matches, not invitations
      - Asymmetric paths (A→B ≠ B→A)
      - Moderator fallback for same-community members with no mutual interactions
      - Cache with 7-day TTL
      - UI shows bridge person name
      - Performance: <100ms for single path, <500ms for batch (10 users)
    - Status: **Planned** - Implement after invitation chain is working
    - Estimate: 6-8 hours
    - Priority: Medium (post-social-graph-UI)
    - Related: ADR-019 (Referral Chain Trust), Social Graph Service (Port 3010)
    - Dependencies:
      - Invitation chain must be working and tested
      - Reputation service must have karma records
      - Need materialized view refresh strategy
    - Notes:
      - **Invitation chain (static)** stays on profile page
      - **Trust path (dynamic)** shows on request/offer tiles
      - These are distinct concepts serving different purposes

46. **Multi-Tier Feed Architecture - Phase 1: Database Schema** ⭐ NEW (2025-12-30)
    - Stream: Feed Features, Platform Architecture
    - Issue: ADR-003 (strict RLS) prevents trust paths from working in small communities
    - Context: Explore-exploit balance needed - communities for cohesion, platform for growth
    - Goal: Implement database schema for three-tier feed architecture
    - Related ADR: ADR-022 (Multi-Tier Feed Architecture)
    - Features:
      - **Tier 1**: My Communities (exploit - high trust, always shown)
      - **Tier 2**: Trust Network (balanced - N-degree connections across communities)
      - **Tier 3**: Platform Network (explore - all users, opt-in, low-risk tasks)
    - Database Changes:
      ```sql
      -- Origin community tracking
      ALTER TABLE auth.users
      ADD COLUMN origin_community_id UUID REFERENCES communities.communities(id);
      ADD COLUMN invited_at TIMESTAMPTZ;

      -- Request visibility control (requester chooses scope)
      ALTER TABLE requests.help_requests
      ADD COLUMN visibility_scope VARCHAR(50) DEFAULT 'community'
        CHECK (visibility_scope IN ('community', 'trust_network', 'platform'));
      ADD COLUMN visibility_max_degrees INTEGER DEFAULT 3
        CHECK (visibility_max_degrees BETWEEN 1 AND 6);

      -- Feed filter preferences (responder chooses what to see)
      ALTER TABLE auth.user_preferences
      ADD COLUMN feed_show_trust_network BOOLEAN DEFAULT true;
      ADD COLUMN feed_trust_network_max_degrees INTEGER DEFAULT 3;
      ADD COLUMN feed_show_platform BOOLEAN DEFAULT false; -- Opt-in to explore
      ADD COLUMN feed_platform_categories JSONB DEFAULT '["digital", "questions"]'::jsonb;

      -- Per-community defaults
      ALTER TABLE communities.communities
      ADD COLUMN default_request_scope VARCHAR(50) DEFAULT 'trust_network';
      ADD COLUMN encourage_platform_participation BOOLEAN DEFAULT false;
      ```
    - Tasks:
      - Add database columns with safe defaults
      - Backfill origin_community_id for existing users (first community joined)
      - Update social-graph-service to set origin_community_id on invitation acceptance
      - Document schema changes in migration
    - Status: **High Priority** - Enables trust paths to work globally
    - Estimate: 2-3 hours
    - Priority: P0 (Critical for social graph features)
    - Related: ADR-022, ADR-003 (evolved), ADR-019 (trust paths), ADR-021 (filtering)
    - Dependencies: None (safe schema additions)

47. **Multi-Tier Feed Architecture - Phase 2: Feed Query Logic** (2025-12-30)
    - Stream: Feed Features
    - Issue: Feed currently only shows community-scoped requests (ADR-003)
    - Goal: Implement three-tier feed query with tunable explore-exploit balance
    - Related ADR: ADR-022
    - Features:
      - Combine Tier 1 (community) + Tier 2 (trust network) + Tier 3 (platform)
      - Respect user feed preferences (degrees, categories, opt-ins)
      - Prioritize community requests first, then trust network, then platform
      - Trust paths computed globally across communities
    - Feed Query:
      ```sql
      -- Combines all three tiers based on user preferences
      SELECT r.*,
        CASE
          WHEN community THEN 'community'
          WHEN trust_network THEN 'trust_network'
          ELSE 'platform'
        END as source_tier,
        tp.degrees as trust_distance
      FROM requests.help_requests r
      LEFT JOIN trust_paths tp ON ...
      WHERE
        (my_communities) OR
        (trust_network AND enabled AND within_degrees) OR
        (platform AND opt_in AND category_match)
      ORDER BY source_tier, created_at DESC;
      ```
    - Files Affected:
      - `services/feed-service/src/index.ts` - Implement query logic
      - `services/social-graph-service/src/services/pathComputation.ts` - Global paths
      - Update RLS policies (relax for reads, keep strict for writes)
    - Tasks:
      - Rewrite feed query to support three tiers
      - Update trust path computation to span communities
      - Relax RLS policies for reads (maintain strict for writes)
      - Add source_tier to feed response
      - Performance testing (index optimization)
    - Status: **Planned** - Implement after Phase 1 schema
    - Estimate: 8-12 hours
    - Priority: P1 (High)
    - Related: ADR-022, Item #46 (Phase 1)
    - Dependencies: Item #46 must be complete

48. **Multi-Tier Feed Architecture - Phase 3: UI for Visibility & Preferences** (2025-12-30)
    - Stream: Frontend Features
    - Issue: No UI for request visibility scope or feed preferences
    - Goal: Let users control explore-exploit balance via UI
    - Related ADR: ADR-022
    - Features:
      - **Create Request**: Visibility scope selector (community/trust_network/platform)
      - **Profile Settings**: Feed preferences (show trust network, max degrees, platform opt-in)
      - **Feed UI**: Visual indicators for source tier (community badge, trust path badge, platform badge)
      - **Help Text**: Explain when to use each scope (task complexity guidance)
    - UI Components:
      - Visibility scope selector (radio buttons with descriptions)
      - Trust network slider (1-6 degrees)
      - Platform opt-in toggle with category checkboxes
      - Source tier badges on feed items
    - Files Affected:
      - `apps/frontend/src/components/CreateRequest.tsx` - Add visibility_scope field
      - `apps/frontend/src/pages/profile.tsx` - Feed preferences section
      - `apps/frontend/src/components/FeedItem.tsx` - Source tier badges
      - `apps/frontend/src/lib/api.ts` - Update request creation API
    - Tasks:
      - Design visibility scope selector UI
      - Implement feed preferences UI
      - Add source tier badges to feed items
      - Update request creation form
      - User testing and iteration
    - Status: **Planned** - Implement after Phase 2 feed logic
    - Estimate: 6-8 hours
    - Priority: P1 (High)
    - Related: ADR-022, Item #47 (Phase 2)
    - Dependencies: Item #47 must be complete

49. **Explore-Exploit Metrics & Tuning** (2025-12-30)
    - Stream: Analytics, Platform Optimization
    - Issue: Need data to tune explore-exploit balance
    - Goal: Track metrics and optimize platform defaults
    - Related ADR: ADR-022
    - Metrics to Track:
      - Feed composition (% community / trust network / platform)
      - Match completion rates by source tier
      - Explore ratio per user/community
      - User engagement by tier
    - Database:
      ```sql
      CREATE TABLE platform.explore_exploit_metrics (
        date DATE,
        user_id UUID,
        community_id UUID,
        community_requests_seen INTEGER,
        trust_network_requests_seen INTEGER,
        platform_requests_seen INTEGER,
        community_matches_completed INTEGER,
        trust_network_matches_completed INTEGER,
        platform_matches_completed INTEGER,
        explore_ratio FLOAT,
        PRIMARY KEY (date, user_id, community_id)
      );
      ```
    - Healthy Balance Targets:
      - 60-70% community matches (strong cohesion)
      - 20-30% trust network matches (building bridges)
      - 10-20% platform matches (exploration/growth)
    - Tuning Levers:
      - Adjust default visibility scopes per request category
      - Adjust default feed preferences for new users
      - Per-community tuning (privacy vs. growth focused)
      - A/B test different defaults
    - Tasks:
      - Create metrics table
      - Implement daily aggregation job
      - Build analytics dashboard (Grafana)
      - Set up alerts for unhealthy ratios
      - A/B testing framework
    - Status: **Post-Launch** - Need user base first
    - Estimate: 12-16 hours
    - Priority: P2 (Medium - post-launch)
    - Related: ADR-022, Grafana/Loki/Prometheus stack
    - Dependencies: Items #46-48 must be complete, need active user base

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

### Mobile App Features (P2) - NEEDS ATTENTION

**Context**: Mobile app exists (Expo React Native, 23 files, 7 Maestro tests) but missing critical features for production use.

34. **Mobile App State Management**
    - Stream: Mobile Development
    - Issue: No centralized state management
    - Current: Each screen fetches data independently, no global state
    - Impact: Data duplication, unnecessary API calls, poor UX
    - Solution: Add Zustand for global state management
    - Features:
      - User session state
      - Community list cache
      - Request/offer cache
      - Optimistic updates
    - Estimate: 6-8 hours
    - **Status**: P2 - Nice to have but app works without it
    - **User Awareness**: "I haven't seen much about mobile apps do we need to figure this out"

35. **Mobile Offline Support**
    - Stream: Mobile Development
    - Issue: No offline capability, app breaks without network
    - Current: All operations require network connection
    - Solution: React Query with persistence + IndexedDB/AsyncStorage
    - Features:
      - Offline read access to cached data
      - Queue failed mutations for retry
      - Sync on reconnection
      - Offline indicator in UI
    - Estimate: 12-15 hours
    - **Status**: P2 - Important for mobile UX but not critical

36. **Mobile Push Notifications**
    - Stream: Mobile Development
    - Issue: No real-time updates on mobile (unlike web SSE)
    - Current: Users must manually refresh to see new requests/offers
    - Solution: Expo Notifications + backend push service
    - Features:
      - Push on new request in community
      - Push on offer received
      - Push on match completion
      - Notification preferences
    - Database: Add push_tokens table
    - Estimate: 10-12 hours
    - **Status**: P2 - Nice to have, SSE works on web

37. **API Mocking Layer for E2E Tests**
    - Stream: Testing Infrastructure
    - Issue: E2E tests hit live APIs, causing flakiness and data pollution
    - Current: Playwright/Maestro tests use real backend
    - Solution: MSW (Mock Service Worker) for frontend, similar for mobile
    - Benefits:
      - Deterministic responses
      - Test error states reliably
      - No backend dependency for UI tests
      - Faster test execution
    - Estimate: 10-12 hours
    - **Status**: P2 - Nice to have but not critical

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
