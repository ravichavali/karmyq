# Archived Scripts

These scripts have been deprecated and replaced by `scripts/deploy.sh`.

## Why Archived

The previous deployment system had two incompatible approaches:
1. `deploy-images.sh` - Used manual `docker run` commands (fragile, no orchestration)
2. `build-images.sh` + `push-images.sh` - Required a registry that added complexity

## New Approach

The new unified approach uses:
- `scripts/deploy.sh` - Single deployment script
- Docker Compose for orchestration
- Build-on-server (no registry needed)

## Archived Files

| File | Original Purpose | Why Deprecated |
|------|------------------|----------------|
| `deploy-images.sh` | Deploy pre-built images via docker run | Used 11 manual docker run commands, no orchestration |
| `build-images.sh` | Build Docker images locally | Replaced by `docker compose build` |
| `push-images.sh` | Push images to registry | Registry no longer used |
| `deploy-legacy.sh` | Original docker-compose deploy | Merged into new deploy.sh |

## Usage

Do NOT use these scripts. Use `scripts/deploy.sh` instead:

```bash
cd ~/karmyq
./scripts/deploy.sh
```

## Date Archived

2026-01-20
