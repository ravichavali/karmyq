# Archived Documentation

This folder contains documentation that is no longer actively maintained or has been superseded by newer implementations.

## Why These Are Archived

### Federation Documents
- **FEDERATION_PROTOCOL.md** - Original ActivityPub-style federation design
- **FEDERATION_IMPLEMENTATION.md** - Implementation guide for federation

**Reason for archival**: After user feedback, we pivoted from federation to a multi-tenant SaaS architecture (v4.0.0). Federation was deemed too complex and didn't match the mutual aid use case. These docs are preserved for reference and for potential future "trust bridges" feature.

**Current approach**: See `docs/MULTI_TENANT_GUIDE.md`

### Obsolete Setup Guides
- **PUSH_TO_GITHUB.md** - One-time GitHub setup instructions
- **GITHUB_SETUP.md** - GitHub repository configuration
- **START_WINDOWS.md** - Windows-specific startup guide

**Reason for archival**: One-time setup docs or platform-specific guides superseded by comprehensive GETTING_STARTED.md

**Current approach**: See `docs/GETTING_STARTED.md` and `docs/DOCKER_SETUP.md`

### Outdated Planning Documents
- **NEXT_STEPS.md** - Old roadmap from earlier versions
- **FINAL_SUMMARY.md** - Summary from a specific development phase
- **RUN_TESTS.md** - Old testing guide

**Reason for archival**: Replaced by more current and comprehensive documentation

**Current approach**:
- Roadmap: See `docs/PROJECT_STATUS.md` → "Next Steps" section
- Testing: See `tests/README.md`

## Accessing Current Documentation

For up-to-date documentation, see:
- **Quick Start**: `docs/GETTING_STARTED.md`
- **Current Status & Roadmap**: `docs/PROJECT_STATUS.md`
- **Multi-Tenant Guide**: `docs/MULTI_TENANT_GUIDE.md`
- **Testing**: `tests/README.md`
- **Development**: `docs/development/`
- **Operations**: `docs/operations/`

---

**Note**: These files are kept for historical reference. If you need federation-style features, review `FEDERATION_PROTOCOL.md` for the original design concepts.
