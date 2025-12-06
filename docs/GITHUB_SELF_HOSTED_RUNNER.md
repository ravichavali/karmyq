# GitHub Self-Hosted Runner Setup for E2E Tests

This guide explains how to set up a GitHub self-hosted runner on your local machine to run E2E tests in CI/CD.

## Why Self-Hosted Runner?

- **Full E2E Testing**: Requires Docker services (PostgreSQL, Redis, 8 backend services, frontend)
- **Local Development**: Tests run on your development machine with access to all services
- **Cost-Effective**: No GitHub Actions minutes used for compute-heavy E2E tests
- **Faster Feedback**: Direct access to local resources, no cloud upload/download

## Prerequisites

- Windows/Linux/macOS machine with:
  - Docker Desktop installed and running
  - Node.js 18+ installed
  - Git installed
  - At least 8GB RAM available
  - Stable internet connection

## Setup Instructions

### 1. Navigate to GitHub Repository Settings

1. Go to your repository on GitHub
2. Click **Settings** → **Actions** → **Runners**
3. Click **New self-hosted runner**
4. Select your operating system (Windows/Linux/macOS)

### 2. Download and Configure Runner

Follow the GitHub instructions to:

**For Windows (PowerShell):**
```powershell
# Create a folder for the runner
mkdir actions-runner; cd actions-runner

# Download the latest runner package
Invoke-WebRequest -Uri https://github.com/actions/runner/releases/download/v2.311.0/actions-runner-win-x64-2.311.0.zip -OutFile actions-runner-win-x64-2.311.0.zip

# Extract the installer
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::ExtractToDirectory("$PWD/actions-runner-win-x64-2.311.0.zip", "$PWD")

# Configure the runner
./config.cmd --url https://github.com/YOUR_USERNAME/karmyq --token YOUR_TOKEN

# Run the runner
./run.cmd
```

**For Linux/macOS:**
```bash
# Create a folder
mkdir actions-runner && cd actions-runner

# Download the latest runner package
curl -o actions-runner-linux-x64-2.311.0.tar.gz -L https://github.com/actions/runner/releases/download/v2.311.0/actions-runner-linux-x64-2.311.0.tar.gz

# Extract the installer
tar xzf ./actions-runner-linux-x64-2.311.0.tar.gz

# Configure the runner
./config.sh --url https://github.com/YOUR_USERNAME/karmyq --token YOUR_TOKEN

# Run the runner
./run.sh
```

### 3. Configure Runner Settings

When prompted during configuration:

- **Runner name**: `karmyq-e2e-runner` (or choose your own)
- **Runner group**: Leave as default
- **Labels**: Add `e2e-tests` label (optional)
- **Work folder**: Leave as default `_work`

### 4. Run as Service (Optional but Recommended)

**Windows (PowerShell as Administrator):**
```powershell
cd actions-runner
./svc.sh install
./svc.sh start
```

**Linux/macOS:**
```bash
sudo ./svc.sh install
sudo ./svc.sh start
```

### 5. Verify Runner is Online

1. Go back to **Settings** → **Actions** → **Runners**
2. You should see your runner listed as "Idle" (green circle)

## Testing the Setup

### Manual Test Run

1. Push a commit or manually trigger the workflow:
   - Go to **Actions** tab
   - Select "E2E Tests" workflow
   - Click "Run workflow"

2. Monitor the run:
   - Watch the workflow execute on your local machine
   - Check Docker containers starting: `docker ps`
   - View test output in real-time

### Expected Workflow

1. ✅ Checkout code
2. ✅ Setup Node.js
3. ✅ Install dependencies
4. ✅ Start Docker services (8 backends + frontend + PostgreSQL + Redis)
5. ✅ Wait for services to be healthy
6. ✅ Run E2E tests with Playwright
7. ✅ Upload test results and screenshots
8. ✅ Cleanup Docker services

## Troubleshooting

### Runner Offline

Check if the runner service is running:

**Windows:**
```powershell
Get-Service actions.runner.*
```

**Linux/macOS:**
```bash
sudo ./svc.sh status
```

Restart if needed:
```bash
sudo ./svc.sh stop
sudo ./svc.sh start
```

### Docker Services Not Starting

Ensure Docker Desktop is running:
```bash
docker ps
```

Check service logs:
```bash
docker-compose -f infrastructure/docker/docker-compose.yml logs
```

### Tests Failing

1. **Rate Limiting**: Ensure `RATE_LIMIT_DISABLED=true` in docker-compose.yml
2. **Port Conflicts**: Check if ports 3000-3008, 5432, 6379 are available
3. **Memory**: Ensure at least 8GB RAM available
4. **Clean State**: Run cleanup between test runs:
   ```bash
   docker-compose -f infrastructure/docker/docker-compose.yml down -v
   ```

### Workflow Doesn't Start

1. Check runner is online in GitHub Settings
2. Verify workflow file syntax: `.github/workflows/e2e-tests.yml`
3. Check workflow is enabled: **Actions** → **E2E Tests** → **Enable workflow**

## Security Considerations

### ⚠️ Important Security Notes

1. **Private Repository Only**: Self-hosted runners on public repos are a security risk
2. **Trusted Code Only**: Runner executes code from your repository
3. **Network Isolation**: Consider running in isolated network/VM for production
4. **Secrets Management**: Use GitHub Secrets for sensitive data, never hardcode

### Recommended Security Setup

1. Run runner in dedicated user account
2. Use firewall rules to restrict network access
3. Monitor runner logs regularly
4. Keep runner updated to latest version

## Maintenance

### Update Runner

GitHub will notify when updates are available:

```bash
cd actions-runner
./config.sh remove  # Unregister current runner
# Download new version
./config.sh --url https://github.com/YOUR_USERNAME/karmyq --token NEW_TOKEN
```

### Monitor Resource Usage

Keep an eye on:
- Disk space (Docker images/volumes)
- Memory usage (multiple services)
- Network bandwidth (test artifacts upload)

### Clean Up Old Test Data

Periodically clean Docker resources:
```bash
docker system prune -a --volumes
```

## Alternative: GitHub-Hosted Runners

If self-hosted runner is not suitable, you can modify `.github/workflows/e2e-tests.yml`:

```yaml
jobs:
  e2e-tests:
    runs-on: ubuntu-latest  # Change from self-hosted

    services:
      postgres:
        image: postgres:15-alpine
        # ... add service configs
```

**Note**: GitHub-hosted runners have limitations:
- 6 hours max run time
- Network latency for service communication
- Limited to runner specifications

## Support

- GitHub Actions Documentation: https://docs.github.com/en/actions/hosting-your-own-runners
- Karmyq E2E Tests: See `tests/e2e/README.md`
- Issues: Report at https://github.com/YOUR_USERNAME/karmyq/issues
