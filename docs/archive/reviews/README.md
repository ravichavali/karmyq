# Architectural Reviews Archive

This directory contains historical architectural reviews and design proposals that informed the development of Karmyq.

## Reviews

### architecture_review_gemini.MD
**Date**: 2024-12-24
**Reviewer**: Antigravity (Gemini AI)
**Status**: Reference only (not all recommendations implemented)

**Key Recommendations**:
1. ⚠️ **Database Coupling** - Services share single PostgreSQL instance with cross-schema foreign keys
2. ⚠️ **API Gateway Missing** - Services exposed on different ports, no centralized gateway
3. ⚠️ **JWT Payload Size** - Communities array could hit HTTP header limits
4. ✅ **Input Validation** - Recommend stricter Zod schemas (partially implemented)

**Implementation Status**:
- Database coupling accepted as trade-off for v8.0 (may revisit in future)
- API Gateway not implemented (services accessed directly)
- JWT payload monitoring in place
- Zod validation used in newer services

### V6_ARCHITECTURAL_REVIEW.md
**Date**: 2025-12-05
**Purpose**: Internal v6.0 pre-release review
**Status**: Completed, addressed in v6.0

**Key Actions Taken**:
- ✅ Consolidated 53 documentation files
- ✅ Standardized service CONTEXT.md format
- ✅ Created unified service template
- ✅ Archived session summaries and version-specific docs
- ✅ Updated root documentation (CLAUDE.md, README.md)

## Active Architecture Documentation

For current architectural documentation, see:
- **[docs/architecture/ARCHITECTURE.md](../architecture/ARCHITECTURE.md)** - Primary architecture reference (v8.0)
- **[CLAUDE.md](../../CLAUDE.md)** - Quick reference for AI assistants
- **[docs/PROJECT_STATUS.md](../PROJECT_STATUS.md)** - Current project status

## Using These Reviews

These reviews are **reference only** and may contain outdated information or unimplemented proposals. They are preserved for:
1. Understanding historical design decisions
2. Tracking which external recommendations were accepted/rejected
3. Planning future architectural improvements
