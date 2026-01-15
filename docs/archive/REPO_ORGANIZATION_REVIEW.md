# Repository Organization Review

**Date**: 2026-01-09
**Purpose**: Assess current documentation structure, identify issues, recommend improvements
**Status**: Draft for Discussion

## Executive Summary

The repository has grown organically over 8 major versions with comprehensive documentation. However, there are opportunities to improve organization, reduce duplication, and make information easier to find.

**Overall Assessment**: 🟡 Good but needs consolidation and cleanup

**Key Issues**:
1. Documentation spread across multiple top-level files and directories
2. Some duplication between backlog/, concepts/, and feature planning docs
3. Several legacy/outdated session summary files at docs/ root
4. ADR numbering conflict (two ADR-006 files)
5. No clear index or navigation guide for new contributors

**Strengths**:
1. Comprehensive ADR collection (23 decisions documented)
2. Good separation of concerns (adr/, architecture/, testing/, operations/)
3. Strong process documentation (DEVELOPMENT_PROCESS.md, DEVELOPMENT_ROADMAP.md)
4. Archive strategy in place for historical docs

---

## Directory Structure Analysis

### Current Structure

```
docs/
├── adr/                          # ✅ GOOD - Architecture Decision Records
├── api/                          # ✅ GOOD - API documentation
├── architecture/                 # ✅ GOOD - System architecture
├── archive/                      # ✅ GOOD - Historical docs
├── backlog/                      # ✅ GOOD - Feature planning (NEW)
├── claude-sessions/              # 🟡 REVIEW - Session transcripts
├── concepts/                     # ✅ GOOD - Conceptual frameworks (NEW)
├── deployment/                   # ✅ GOOD - Deployment guides
├── development/                  # 🟡 REVIEW - Overlaps with root files
├── features/                     # 🟡 REVIEW - Overlaps with backlog/
├── gemini-architecture-review/   # 🟡 ARCHIVE? - One-time review
├── getting-started/              # ✅ GOOD - Onboarding
├── guides/                       # ✅ GOOD - How-to guides
├── operations/                   # ✅ GOOD - Ops documentation (NEW)
├── requirements/                 # 🟡 REVIEW - Mostly empty
├── schema/                       # 🟡 REVIEW - Database schema docs
├── testing/                      # ✅ GOOD - Testing documentation
│
├── API_RESPONSE_STANDARD.md      # ✅ GOOD - Could move to api/
├── CLAUDE_SESSION_WORKFLOW.md    # ✅ GOOD - Process doc
├── CONTEXT_LOSS_ANALYSIS.md      # 🟡 ARCHIVE? - Historical analysis
├── DEPLOYMENT_DECISION.md        # 🟡 ARCHIVE? - Specific to one deployment
├── DEVELOPMENT_PROCESS.md        # ✅ GOOD - Core process doc
├── DEVELOPMENT_ROADMAP.md        # ✅ GOOD - Core roadmap
├── MULTI_TENANT_GUIDE.md         # ✅ GOOD - Could move to guides/
├── PROJECT_STATUS.md             # 🟡 STALE? - Last updated Dec 14
├── QUICK_REFERENCE.md            # ✅ GOOD - Developer quick ref
├── README.md                     # ✅ GOOD - Docs index
├── ROADMAP_NEXT_3_WEEKS.md       # 🟡 STALE? - Time-bound roadmap
├── SESSION_SUMMARY_*.md          # 🟡 ARCHIVE? - Move to claude-sessions/
├── T-013-*.md                    # 🟡 ARCHIVE? - Specific test session
├── TANGENT_MANAGEMENT.md         # ✅ GOOD - Process doc
├── TDD_WORKFLOW.md               # ✅ GOOD - Process doc
├── TEST_SUMMARY.md               # 🟡 STALE? - Last updated Dec 30
├── TRACK_B_ANTIGRAVITY_PROMPT.md # 🟡 UNCLEAR - What is this?
└── CAPTURED_TANGENTS_*.md        # 🟡 ARCHIVE? - Historical tangent list
```

### Issues Identified

#### 1. ADR Numbering Conflict

**Problem**: Two files named ADR-006:
- `docs/adr/ADR-006-standardized-api-response.md`
- `docs/adr/ADR-006-synthetic-user-simulation.md`

**Impact**: Confusion, broken links, merge conflicts

**Recommendation**: Renumber ADR-006-synthetic-user-simulation to ADR-024

#### 2. Root-Level File Sprawl

**Problem**: 19 markdown files at `docs/` root level

**Issues**:
- Hard to find specific information
- No clear hierarchy
- Mixes process docs, session summaries, and historical files

**Recommendation**: Consolidate into subdirectories

#### 3. Duplicate/Overlapping Directories

**Problem**:
- `features/` vs `backlog/` - both contain feature planning
- `development/` vs root process docs - both have development guides
- `schema/` vs `architecture/` - schema docs in both places

**Recommendation**: Consolidate overlapping content

#### 4. Stale/Time-Bound Documents

**Problem**: Several docs reference specific dates/sessions:
- `ROADMAP_NEXT_3_WEEKS.md` - Time-bound (when was it written?)
- `SESSION_SUMMARY_2025-12-28.md` - Session-specific
- `CAPTURED_TANGENTS_2025-12-28.md` - Session-specific
- `T-013-SUMMARY.md` - Test session specific
- `PROJECT_STATUS.md` - Last updated Dec 14, potentially stale

**Recommendation**: Archive or update

#### 5. Unclear Purpose Files

**Problem**: Some files lack clear purpose:
- `TRACK_B_ANTIGRAVITY_PROMPT.md` - What is Track B? Why "antigravity"?
- `CONTEXT_LOSS_ANALYSIS.md` - Historical analysis, still relevant?

**Recommendation**: Add context or archive

---

## Proposed Reorganization

### Phase 1: Quick Wins (No Breaking Changes)

**1. Fix ADR Numbering Conflict** ⚠️ HIGH PRIORITY
```bash
# Renumber synthetic user simulation ADR
mv docs/adr/ADR-006-synthetic-user-simulation.md docs/adr/ADR-024-synthetic-user-simulation.md

# Update ADR README index
# Update any references in other docs
```

**2. Move Session Summaries to Archive**
```bash
mv docs/SESSION_SUMMARY_2025-12-28.md docs/archive/session-summaries/
mv docs/CAPTURED_TANGENTS_2025-12-28.md docs/archive/session-summaries/
mv docs/T-013-SUMMARY.md docs/archive/session-summaries/
mv docs/T-013-TEST-RESULTS.md docs/archive/session-summaries/
```

**3. Archive Historical Analysis Docs**
```bash
mv docs/CONTEXT_LOSS_ANALYSIS.md docs/archive/
mv docs/DEPLOYMENT_DECISION.md docs/archive/
mv docs/TRACK_B_ANTIGRAVITY_PROMPT.md docs/archive/ # Or delete if not needed
```

**4. Consolidate Guides**
```bash
mv docs/API_RESPONSE_STANDARD.md docs/api/
mv docs/MULTI_TENANT_GUIDE.md docs/guides/
```

**5. Update Stale Docs**
- Update `PROJECT_STATUS.md` or archive it
- Update `ROADMAP_NEXT_3_WEEKS.md` or replace with link to DEVELOPMENT_ROADMAP.md
- Update `TEST_SUMMARY.md` or archive it

### Phase 2: Structural Improvements (Requires Review)

**1. Consolidate Feature Planning**

**Current**: Features in `features/`, `backlog/`, root files
**Proposed**: Everything in `backlog/`

```
backlog/
├── README.md                              # Index of all planned features
├── LANDING_PAGE_CONTENT.md                # ✅ Already here
├── LANDING_PAGE_VISION.md                 # ✅ Already here
├── POLYMORPHIC_REQUEST_SYSTEM.md          # ✅ Already here
├── TRUST_REPUTATION_FEATURES.md           # ✅ Already here
├── [Move from features/]
└── [Move any planning docs from root]
```

**2. Consolidate Conceptual Docs**

**Current**: Concepts in new `concepts/` dir, some in root
**Proposed**: Expand `concepts/` for all conceptual frameworks

```
concepts/
├── README.md                              # Index of frameworks
├── TRUST_AND_REPUTATION_FRAMEWORK.md      # ✅ Already here
└── [Any other conceptual frameworks]
```

**3. Clarify Development vs Process**

**Current**: Development guides in `development/` and root
**Proposed**: Clear separation

```
Root level (process docs):
- DEVELOPMENT_PROCESS.md       # ✅ How to develop
- DEVELOPMENT_ROADMAP.md        # ✅ What we're building
- TANGENT_MANAGEMENT.md         # ✅ How to handle tangents
- TDD_WORKFLOW.md               # ✅ TDD process
- CLAUDE_SESSION_WORKFLOW.md    # ✅ Session workflow

development/ (developer tools/guides):
- [Specific development guides]
- [Code generation tools]
- [Local setup scripts]
```

### Phase 3: Navigation Improvements

**1. Create Master Index**

Create `docs/INDEX.md` with categorized links to all major docs:

```markdown
# Karmyq Documentation Index

## Getting Started
- [Project README](README.md)
- [Quick Reference](QUICK_REFERENCE.md)
- [Getting Started Guide](getting-started/)

## Development Process
- [Development Process](DEVELOPMENT_PROCESS.md) ⭐ Read First
- [Development Roadmap](DEVELOPMENT_ROADMAP.md) ⭐ Current Work
- [TDD Workflow](TDD_WORKFLOW.md)
- [Tangent Management](TANGENT_MANAGEMENT.md)

## Architecture & Design
- [System Architecture](architecture/ARCHITECTURE.md)
- [Data Flows](architecture/DATA_FLOWS.md)
- [Architecture Decision Records](adr/)

## Implementation Planning
- [Feature Backlog](backlog/)
- [Conceptual Frameworks](concepts/)

## Operations & Deployment
- [Operations Documentation](operations/)
- [Deployment Guides](deployment/)

## Testing
- [Testing Documentation](testing/)
```

**2. Improve README Files in Each Directory**

Each subdirectory should have a `README.md` explaining:
- What this directory contains
- How to navigate it
- Links to key documents

**3. Add Badges/Status Indicators**

Use consistent badges in docs:
- ⭐ Read First
- ✅ Current / Active
- 🟡 Review Needed
- 📚 Archive / Historical
- 🚧 Work In Progress

---

## Recommended Actions (Prioritized)

### Immediate (This Session)

1. **Fix ADR-006 numbering conflict** - Renumber to ADR-024
2. **Move session summaries to archive** - Clean up root
3. **Update docs/README.md** - Add navigation to new backlog/ and concepts/

### Short Term (Next Session)

4. **Archive historical docs** - Move CONTEXT_LOSS_ANALYSIS, etc.
5. **Update stale docs** - PROJECT_STATUS, TEST_SUMMARY, etc.
6. **Create docs/INDEX.md** - Master navigation

### Medium Term (Next Sprint)

7. **Consolidate feature planning** - Everything to backlog/
8. **Improve directory READMEs** - Navigation in each dir
9. **Review and clean features/** - Merge with backlog or archive
10. **Review requirements/** - Archive if mostly empty

### Long Term (When Needed)

11. **Consider docs framework** - MkDocs, Docusaurus, etc. for better navigation
12. **Add search** - If docs grow significantly
13. **Create contribution guide** - How to add new docs

---

## Documentation Quality Assessment

### Strong Areas ✅

1. **Architecture Decision Records (adr/)**
   - 23 ADRs covering major decisions
   - Good template consistency
   - Well-indexed in README

2. **Process Documentation**
   - DEVELOPMENT_PROCESS.md is comprehensive
   - DEVELOPMENT_ROADMAP.md actively maintained
   - Clear testing requirements

3. **Service Documentation**
   - Each service has CONTEXT.md and README.md
   - Standardized format across services

4. **Operations Documentation**
   - Recently created, comprehensive
   - Deployment guides, runbooks, access guides

### Improvement Areas 🟡

1. **Navigation & Discovery**
   - No master index
   - Hard to find specific information
   - Too many root-level files

2. **Freshness Indicators**
   - Unclear which docs are current vs historical
   - Some stale docs mixed with current

3. **Cross-References**
   - Some broken links (especially with ADR-006 conflict)
   - Missing breadcrumbs/back links

4. **Duplication**
   - Some overlap between directories
   - Multiple places to document features

---

## Validation Checks

### Links Audit

**Action Needed**: Run link checker to find broken links

```bash
# Can use tool like markdown-link-check
npx markdown-link-check docs/**/*.md
```

### Completeness Audit

**Questions to Answer**:
- [ ] Does every service have up-to-date CONTEXT.md?
- [ ] Are all ADRs referenced in adr/README.md?
- [ ] Are all backlog items in backlog/ or properly tracked?
- [ ] Is DEVELOPMENT_ROADMAP.md accurate?
- [ ] Are testing docs current with actual test suite?

### Accessibility Audit

**Questions to Answer**:
- [ ] Can a new developer find onboarding docs easily?
- [ ] Can someone understand the system architecture from docs?
- [ ] Is the development process clear?
- [ ] Can someone find feature planning docs?

---

## Next Steps

1. **Discuss with user**: Which reorganization priorities are most important?
2. **Make immediate fixes**: ADR numbering, session summary moves
3. **Create cleanup plan**: Schedule deeper reorganization
4. **Set documentation standards**: How to maintain organization going forward

---

## Related Documents

- [DEVELOPMENT_PROCESS.md](DEVELOPMENT_PROCESS.md) - Development workflow
- [DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md) - Current roadmap
- [docs/README.md](README.md) - Docs overview
- [adr/README.md](adr/README.md) - ADR index
- [TANGENT_MANAGEMENT.md](TANGENT_MANAGEMENT.md) - How to handle tangents
