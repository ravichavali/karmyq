# Karmyq Development Roadmap - Next 3 Weeks

**Created**: 2025-12-27
**Version**: v8.0.0 → v9.0.0 → v9.1.0
**Scope**: Complete polymorphic requests, fix geocoding, lay trust system foundation

---

## 🎯 Strategic Priorities

Based on our discussion, here are the priorities in order:

1. **Complete polymorphic requests feature** (everything-app-foundation branch)
2. **Fix Nominatim geocoding integration** (production blocker for rides)
3. **Lay foundation for Trust & Safety system** (questionnaires, basic schema)
4. **Implement Social Graph Phase 1** (invitation tracking)
5. **Complete unit test coverage** (Auth, Community, Cleanup services)

---

## 📅 Week 1: Complete v9.0.0 & Merge Feature Branch

### **Day 1-2: Polymorphic Request Service Backend** ⚡ CRITICAL
**Goal**: Backend validation for all 5 request types

**Tasks**:
1. Create Zod validation schemas for each type
   - `services/request-service/src/schemas/RideSchema.ts`
   - `services/request-service/src/schemas/BorrowSchema.ts`
   - `services/request-service/src/schemas/ServiceSchema.ts`
   - `services/request-service/src/schemas/EventSchema.ts`
   - `services/request-service/src/schemas/GenericSchema.ts`

2. Update Request Service to validate payloads
   - Modify `POST /requests` to check `request_type` and validate `payload`
   - Return helpful validation errors

3. Implement type-specific matching logic
   - **Ride**: GPS distance matching (haversine formula for now, PostGIS later)
   - **Service**: Category + skill level matching
   - **Borrow**: Item category + condition matching
   - **Event**: Date + location + participant matching
   - **Generic**: Existing algorithm

4. Add 25+ tests for polymorphic validation
   - Test each schema validates correctly
   - Test matching algorithms per type
   - Test error messages

**Deliverables**:
- ✅ Type-safe payload validation
- ✅ Type-specific matching algorithms
- ✅ 25+ passing tests
- ✅ API returns clear validation errors

**Effort**: 12-14 hours

---

### **Day 3: Fix Nominatim Geocoding Integration** ⚡ CRITICAL
**Goal**: Real geocoding for ride matching

**Tasks**:
1. Wire up existing `geocodingCache.ts` to LocationPicker
   - Replace placeholder random coordinates in `LocationPicker.tsx:24-32`
   - Use `searchLocation()` from `apps/frontend/src/lib/geocodingCache.ts`
   - Test with real Nominatim API calls

2. Verify geocoding-service (port 3009) is working
   - Test `/search?q=Oakland` endpoint
   - Check cache hits/misses with `/stats`
   - Verify rate limiting (1 req/sec to Nominatim)

3. Add fallback handling
   - If Nominatim fails, show user-friendly error
   - Allow manual lat/lng input as fallback

4. Test end-to-end ride flow
   - Create ride request with real address
   - Verify coordinates stored correctly
   - Test distance-based matching works

**Deliverables**:
- ✅ LocationPicker uses real geocoding
- ✅ Ride matching uses actual GPS coordinates
- ✅ Graceful fallback for geocoding failures

**Effort**: 4-6 hours

---

### **Day 4: Testing & Bug Fixes** 🧪
**Goal**: Ensure feature branch is merge-ready

**Tasks**:
1. Run full test suite
   ```bash
   npm run test:all
   npm run test:integration
   npm run test:unit
   ```

2. Fix any regressions or failures

3. Manual QA testing
   - Create requests of all 5 types
   - Test matching for each type
   - Verify geocoding works for rides
   - Test on mobile-responsive view

4. Update documentation
   - Add polymorphic request examples to docs
   - Update API documentation
   - Add screenshots to README

**Deliverables**:
- ✅ All tests passing (163 unit + 126 integration + E2E)
- ✅ No regressions
- ✅ Documentation updated

**Effort**: 6-8 hours

---

### **Day 5: Merge to Master & Tag v9.0.0** 🚀
**Goal**: Release polymorphic requests feature

**Tasks**:
1. Final review
   - Code review polymorphic logic
   - Check all files committed
   - Verify no debug code left

2. Update version numbers
   - `claude.md`: v8.0.0 → v9.0.0
   - `package.json`: 7.0.0 → 9.0.0
   - `docs/PROJECT_STATUS.md`: Update current status

3. Merge feature branch
   ```bash
   git checkout master
   git merge feature/everything-app-foundation
   git tag v9.0.0
   git push origin master v9.0.0
   ```

4. Create release notes
   - Document new features (5 request types)
   - Document breaking changes (if any)
   - Update migration guide

**Deliverables**:
- ✅ v9.0.0 on master
- ✅ Feature branch merged
- ✅ Release notes published

**Effort**: 2-3 hours

---

## 📅 Week 2: Trust & Safety Foundation (v9.1.0)

### **Day 6-7: Database Schema for Trust System** 🛡️
**Goal**: Add trust profiles, safety reports, questionnaire tables

**Tasks**:
1. Create migration script
   - `infrastructure/postgres/migrations/009_trust_system.sql`

2. Add trust profile tables
   ```sql
   auth.user_trust_profiles
   communities.community_trust_profiles
   communities.user_trust_ladder
   communities.safety_reports
   auth.user_safety_scores
   auth.user_onboarding_responses
   communities.community_onboarding_responses
   ```

3. Add indexes for performance
   - Index on `trust_personality`
   - Index on `openness_level`
   - Index on `current_level` (trust ladder)

4. Run migration on dev environment
   ```bash
   cat migrations/009_trust_system.sql | docker exec -i karmyq-postgres psql -U karmyq_user -d karmyq_db
   ```

5. Add 15+ tests for schema
   - Test RLS policies work correctly
   - Test foreign key constraints
   - Test default values

**Deliverables**:
- ✅ Migration script tested
- ✅ All trust tables created
- ✅ Indexes added
- ✅ Schema tests passing

**Effort**: 8-10 hours

---

### **Day 8-9: User Onboarding Questionnaire** 📋
**Goal**: Collect trust preferences during signup

**Tasks**:
1. Create questionnaire component
   - `apps/frontend/src/components/onboarding/UserTrustQuestionnaire.tsx`
   - 5 questions (trust strangers, travel distance, prefer verified, prefer mutual, max weekly exchanges)
   - Modern UI with scale sliders, select dropdowns

2. Calculate trust personality
   - `apps/frontend/src/lib/trustCalculator.ts`
   - Algorithm: Score from responses → 'very_cautious' | 'cautious' | 'moderate' | 'high_trust'

3. Save responses to database
   - POST `/api/onboarding/trust-profile`
   - Store in `auth.user_onboarding_responses`
   - Calculate and store `trust_personality` in `auth.user_trust_profiles`

4. Update signup flow
   - Add questionnaire step after email verification
   - Show progress indicator (Step 2 of 3)
   - Allow skip (default to 'moderate')

5. Add backend endpoint
   - `services/auth-service/src/routes/onboarding.ts`
   - Validate questionnaire responses
   - Calculate trust profile
   - Return profile to frontend

**Deliverables**:
- ✅ Questionnaire UI implemented
- ✅ Trust personality calculation working
- ✅ Responses saved to database
- ✅ Signup flow updated

**Effort**: 10-12 hours

---

### **Day 10: Community Onboarding Questionnaire** 🏘️
**Goal**: Collect community openness preferences

**Tasks**:
1. Create admin questionnaire component
   - `apps/frontend/src/components/communities/CommunityTrustQuestionnaire.tsx`
   - 5 questions (openness, verification, trust ladder, geographic restriction, moderation)

2. Save community trust profile
   - POST `/api/communities/:id/trust-profile`
   - Store in `communities.community_trust_profiles`

3. Update community creation flow
   - Add trust questionnaire step
   - Show recommendations based on responses
   - Preview impact on membership

4. Add backend endpoint
   - `services/community-service/src/routes/trust-profiles.ts`
   - Validate responses
   - Apply community settings

**Deliverables**:
- ✅ Community questionnaire implemented
- ✅ Trust profiles saved for communities
- ✅ Community creation flow updated

**Effort**: 6-8 hours

---

## 📅 Week 3: Social Graph Foundation & Unit Tests

### **Day 11-12: Social Graph Phase 1 - Invitation Tracking** 🔗
**Goal**: Track who invited whom, show on profiles

**Tasks**:
1. Create database schema
   ```sql
   auth.user_invitations
   auth.inviter_stats
   ```

2. Update users table
   ```sql
   ALTER TABLE auth.users ADD COLUMN invited_by UUID;
   ALTER TABLE auth.users ADD COLUMN invitation_accepted_at TIMESTAMP;
   ```

3. Add invitation code generation
   - `POST /api/invitations/generate`
   - Format: `KARMYQ-[NAME]-[YEAR]-[4-CHAR-CODE]`
   - Store in `user_invitations` table

4. Update signup flow to accept invitation code
   - Add "Invitation Code" field to registration
   - Validate code on backend
   - Link inviter → invitee

5. Show "Invited by X" on profiles
   - Add to user profile component
   - `apps/frontend/src/components/UserProfile.tsx`
   - Only show if user allows (`show_who_invited_me = true`)

6. Add basic 1-degree connection display
   - Show on request cards: "Connected through Mike Chen"
   - Badge: "1° connection"

**Deliverables**:
- ✅ Invitation code generation working
- ✅ Signup accepts invitation codes
- ✅ "Invited by X" shown on profiles
- ✅ 1-degree connections displayed

**Effort**: 10-12 hours

---

### **Day 13-14: Feed Ranking with Social Proximity** 🎯
**Goal**: Boost requests from direct connections

**Tasks**:
1. Update feed algorithm
   - `services/feed-service/src/services/trustAwareFeedComposer.ts`
   - Check if requester is 1-degree connection
   - Boost match score by 30 points if direct connection

2. Add social context to feed response
   ```json
   {
     "social_context": {
       "degrees_of_separation": 1,
       "connected_through": "Mike Chen",
       "connection_type": "invited_by"
     }
   }
   ```

3. Update frontend to show social context
   - Request cards show connection badge
   - Filter: "Show only my network (1°)"

4. Add 15+ tests for trust-aware ranking
   - Test 1° connections ranked higher
   - Test filter works correctly
   - Test privacy settings respected

**Deliverables**:
- ✅ Feed prioritizes 1° connections
- ✅ Social context shown on request cards
- ✅ Filter by network working
- ✅ Tests passing

**Effort**: 8-10 hours

---

### **Day 15: Complete Unit Test Coverage** 🧪
**Goal**: Fill test coverage gaps

**Tasks**:
1. Auth Service tests (15 tests)
   - JWT generation/verification
   - Multi-community token refresh
   - Password hashing
   - User validation

2. Community Service tests (12 tests)
   - Membership management
   - Dunbar's number enforcement
   - Norm voting
   - Join request approval

3. Cleanup Service tests (10 tests)
   - TTL expiration logic
   - Reputation decay calculation
   - Activity tracking
   - Soft delete workflow

4. Notification Service tests (15 more tests)
   - All 12 template types
   - Priority classification
   - Channel selection
   - Preference filtering

**Deliverables**:
- ✅ 52+ new tests added
- ✅ Total tests: 215+ (was 163)
- ✅ Coverage gaps filled

**Effort**: 8-10 hours

---

## 🎯 Deliverables Summary

### Week 1 (v9.0.0)
- ✅ Polymorphic request backend complete
- ✅ Real geocoding integrated
- ✅ Feature branch merged
- ✅ v9.0.0 released

### Week 2 (v9.1.0 - Trust Foundation)
- ✅ Trust system database schema
- ✅ User trust questionnaire
- ✅ Community trust questionnaire
- ✅ Basic trust profiles working

### Week 3 (v9.1.0 - Social Graph & Tests)
- ✅ Invitation tracking implemented
- ✅ 1-degree connection display
- ✅ Feed ranking with social proximity
- ✅ Unit test coverage complete (215+ tests)

---

## 📊 Metrics to Track

| Metric | Current | Week 1 Target | Week 3 Target |
|--------|---------|---------------|---------------|
| **Unit Tests** | 163 | 188 (polymorphic tests) | 215+ |
| **Request Types** | 1 (generic) | 5 (ride, borrow, service, event, generic) | 5 |
| **Geocoding** | Placeholder | Real Nominatim | Real + cache |
| **Social Graph** | None | None | 1-degree tracking |
| **Trust Profiles** | None | None | User + Community |
| **Feed Ranking** | Generic | Generic | Social proximity aware |

---

## 🚧 Deferred to Future (v10.0+)

**Not in scope for next 3 weeks:**

1. **PostGIS Spatial Queries** - Haversine formula sufficient for MVP
2. **Multi-degree path computation (2°, 3°, 4°)** - Phase 2 of social graph
3. **Safety reporting UI** - Have database schema, UI later
4. **Trust ladder progression logic** - Have schema, logic later
5. **Dynamic form system** - Static forms work for now
6. **Mobile app testing** - Web version sufficient
7. **API Gateway** - Direct service access works
8. **Vector search** - Future enhancement

---

## 🎯 Success Criteria

### Week 1 Success
- [ ] Can create all 5 request types (Ride, Borrow, Service, Event, Generic)
- [ ] Ride requests use real GPS coordinates from Nominatim
- [ ] Type-specific matching works (rides match by distance)
- [ ] All 188+ tests passing
- [ ] v9.0.0 tagged and on master

### Week 2 Success
- [ ] New users complete trust questionnaire during signup
- [ ] Community admins configure trust settings
- [ ] Trust profiles stored in database
- [ ] Feed respects trust preferences (basic filtering)

### Week 3 Success
- [ ] Users can generate invitation codes
- [ ] Invitation tracking works (who invited whom)
- [ ] Request cards show "1° connection" badge
- [ ] Feed prioritizes direct connections
- [ ] 215+ tests passing (all services covered)
- [ ] v9.1.0 ready for release

---

## 🔥 Critical Path

**Must complete in order:**

1. **Polymorphic backend** → blocks merge
2. **Geocoding fix** → blocks ride matching
3. **Merge v9.0.0** → unblocks trust work
4. **Trust schema** → blocks questionnaires
5. **Questionnaires** → blocks trust-aware feed
6. **Invitation tracking** → blocks social graph
7. **Feed ranking** → completes v9.1.0

**Can do in parallel:**
- Unit tests (any time)
- Documentation updates (any time)
- UI polish (after core features work)

---

## 💡 Next Steps (When You're Ready)

**To start Week 1, Day 1-2**, I can help with:

1. **Create polymorphic validation schemas**
   - All 5 Zod schemas (Ride, Borrow, Service, Event, Generic)
   - With TypeScript types

2. **Update Request Service routes**
   - Add type validation to `POST /requests`
   - Implement matching logic per type

3. **Write tests**
   - 25+ test cases for all types

Just say "Let's start Week 1" and I'll begin!

---

**Roadmap Version**: 1.0
**Last Updated**: 2025-12-27
**Owner**: Karmyq Development Team
