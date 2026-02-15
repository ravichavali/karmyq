# Version Drift Report

**Generated**: 2026-02-15T15:34:15.975Z

⚠️ **Warning**: The following dependencies have version drift across services:

## axios

- **^1.6.2**: feed-service
- **^1.6.0**: simulation-service

## dotenv

- **^16.3.1**: feed-service
- **^16.3.0**: simulation-service

## jsonwebtoken

- **^9.0.2**: feed-service
- **^9.0.0**: simulation-service

## pg

- **^8.11.3**: feed-service, geocoding-service
- **^8.12.0**: simulation-service

## Recommendation

Hoist common dependencies to root `package.json` to ensure version consistency.
