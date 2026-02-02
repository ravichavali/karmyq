# Version Drift Report

**Generated**: 2026-02-02T17:01:15.849Z

⚠️ **Warning**: The following dependencies have version drift across services:

## axios

- **^1.6.2**: feed-service
- **^1.6.0**: simulation-service

## Recommendation

Hoist common dependencies to root `package.json` to ensure version consistency.
