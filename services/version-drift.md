# Version Drift Report

**Generated**: 2026-01-30T21:38:45.065Z

⚠️ **Warning**: The following dependencies have version drift across services:

## axios

- **^1.6.2**: feed-service
- **^1.6.0**: simulation-service

## Recommendation

Hoist common dependencies to root `package.json` to ensure version consistency.
