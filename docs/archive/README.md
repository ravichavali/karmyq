# Archived Documentation

This directory contains historical documentation that is no longer actively maintained but preserved for reference.

## Structure

### session-summaries/
Development session summaries from v5.x development cycles. These provided snapshots of progress during active development but are superseded by the current documentation.

**Archived Files:**
- `SESSION_SUMMARY_V5.2.md` - v5.2.0 development session
- `SESSION_SUMMARY_V5.3.md` - v5.3.0 development session
- `SESSION_SUMMARY_V5_4.md` - v5.4.0 development session

**Reason for Archival:** Historical development notes. Current status documented in [PROJECT_STATUS.md](../PROJECT_STATUS.md).

### releases/
Version-specific fix documentation and testing checklists from v5.x releases.

**Archived Files:**
- `FIXES_V5.3.1.md` - Bug fixes in v5.3.1
- `TEST_FIXES_DETAILED.md` - Detailed test fixes
- `TEST_RESULTS_BASELINE.md` - Baseline test results
- `TESTING_CHECKLIST_V5.3.md` - v5.3 testing checklist

**Reason for Archival:** Version-specific documentation superseded by [development/testing-guide.md](../development/testing-guide.md).

### planning/
Historical feature planning documents from v5.x development.

**Archived Files:**
- `DASHBOARD_REDESIGN_V5.3.md` - Dashboard redesign planning
- `INLINE_MESSAGING_PLAN.md` - Inline messaging feature plan
- `MOBILE_APP_FINAL_STEPS.md` - Mobile app completion steps
- `MOBILE_APP_PORT_V5_4.md` - Mobile app port planning
- `MOBILE_APP_PROGRESS_V5_4.md` - Mobile app progress tracking
- `REFACTOR_REQUEST_ARCHITECTURE_V5.4.md` - Request service refactor

**Reason for Archival:** Completed features now documented in requirements and implementation docs. Future planning tracked in GitHub Issues.

### federation/
Federation protocol documentation (archived in v4.0.0).

**Archived Files:**
- `FEDERATION_PROTOCOL.md` - Cross-instance federation design
- `FEDERATION_IMPLEMENTATION.md` - Implementation guide

**Reason for Archival:** Project pivoted to multi-tenant SaaS architecture in v4.0.0. Federation may be revisited in future phases. See [MULTI_TENANT_GUIDE.md](../MULTI_TENANT_GUIDE.md) for current architecture.

## Using Archived Documentation

These documents are preserved for:
- **Historical Context** - Understanding past decisions and evolution
- **Reference** - Looking up how features were originally implemented
- **Learning** - Seeing development process and iterations

For current documentation, see:
- [docs/README.md](../README.md) - Main documentation index
- [PROJECT_STATUS.md](../PROJECT_STATUS.md) - Current status and roadmap
- [requirements/](../requirements/) - Current requirements and specifications

## Archival Policy

Documents are archived when:
1. **Version-Specific** - Only relevant to a past version
2. **Superseded** - Replaced by updated documentation
3. **Completed Planning** - Feature implemented and documented elsewhere
4. **Historical Notes** - Development session notes and progress tracking

All archived documents remain in git history and can be referenced by commit hash.

---

**Last Updated**: v6.0.0 (2025-12-05)
