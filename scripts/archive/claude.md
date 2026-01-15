# Scripts Directory

## Overview
Development and operational scripts for the Karmyq platform.

## Subdirectories

### dev/
Development helper scripts:
- `start.sh` - Start development environment
- `reset-db.sh` - Reset database to clean state
- `seed-data.sh` - Populate test data

### setup/
Initial setup scripts:
- Environment configuration
- Dependency installation
- First-run initialization

### data/
Data management scripts:
- Export utilities
- Import utilities
- Migration helpers

## Usage Examples

```bash
# Start development environment
bash scripts/dev/start.sh

# Reset and reseed database
bash scripts/dev/reset-db.sh
bash scripts/dev/seed-data.sh
```

## Script Conventions
- Use bash for cross-platform compatibility
- Include error handling with `set -e`
- Log output to stdout/stderr appropriately
- Accept environment variables for configuration
