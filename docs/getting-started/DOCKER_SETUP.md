# Docker Setup for Karmyq

## Issue: Docker Desktop Not Running

You're seeing this error because Docker Desktop needs to be running before you can start containers.

## Quick Fix (2 minutes)

### Step 1: Start Docker Desktop

1. **Find Docker Desktop**:
   - Press `Windows Key`
   - Type "Docker Desktop"
   - Click to open it

2. **Wait for Docker to Start**:
   - You'll see a whale icon in your system tray (bottom-right)
   - Wait until it says "Docker Desktop is running"
   - This takes about 30-60 seconds

### Step 2: Verify Docker is Running

In PowerShell or Command Prompt:

```powershell
docker --version
```

You should see something like: `Docker version 24.0.x`

### Step 3: Start Karmyq

```powershell
docker compose up --build
```

Note: Use `docker compose` (with space) not `docker-compose` (with hyphen)

## If Docker Desktop Isn't Installed

### Download and Install

1. **Download**: https://www.docker.com/products/docker-desktop/
2. **Install**: Run the installer
3. **Restart**: Restart your computer
4. **Enable WSL 2**: During setup, enable WSL 2 backend (recommended)
5. **Start Docker Desktop**: Open from Start Menu

### System Requirements

- Windows 10 64-bit: Pro, Enterprise, or Education (Build 19041 or higher)
- OR Windows 11 64-bit
- WSL 2 feature enabled
- Virtualization enabled in BIOS

## Common Issues

### Issue 1: "Docker daemon is not running"

**Fix**: Start Docker Desktop from the Start Menu

### Issue 2: "WSL 2 installation is incomplete"

**Fix**: 
```powershell
wsl --install
```
Then restart your computer.

### Issue 3: "Virtualization is disabled"

**Fix**: Enable virtualization in BIOS:
1. Restart computer
2. Enter BIOS (usually F2, F10, or Delete key)
3. Find "Virtualization Technology" or "VT-x"
4. Enable it
5. Save and exit

### Issue 4: "Version attribute is obsolete" warning

This is just a warning, not an error. It won't affect functionality.
We'll fix it by removing the version line from docker-compose.yml.

## Alternative: Run Without Docker (Advanced)

If you can't use Docker, you can run services manually:

### 1. Install PostgreSQL locally
```powershell
# Using Chocolatey
choco install postgresql
```

### 2. Install Redis locally
```powershell
# Using Chocolatey
choco install redis
```

### 3. Install Node.js
```powershell
# Download from nodejs.org
# Or: choco install nodejs
```

### 4. Run each service manually
```powershell
# Terminal 1: Auth Service
cd services/auth-service
npm install
npm run dev

# Terminal 2: Frontend
cd frontend
npm install
npm run dev
```

But Docker is **much easier**! Just start Docker Desktop.

## Quick Commands Reference

```powershell
# Start Docker Desktop (if not running)
# Use Start Menu -> Docker Desktop

# Check Docker is running
docker --version

# Start Karmyq (use space, not hyphen)
docker compose up --build

# Stop Karmyq
docker compose down

# View logs
docker compose logs -f

# Restart one service
docker compose restart auth-service
```

## After Docker Desktop Starts

Run this:

```powershell
docker compose up --build
```

Wait 1-2 minutes for all services to start, then:
- Frontend: http://localhost:3000
- Auth API: http://localhost:3001
- Redis Commander: http://localhost:8081

## Still Having Issues?

1. **Restart Docker Desktop**: Right-click Docker icon → Restart
2. **Restart Computer**: Sometimes needed after fresh install
3. **Check Docker Status**: Look at Docker Desktop dashboard
4. **View Logs**: Click on Docker Desktop to see what's happening

---

**TL;DR**: Open Docker Desktop from your Start Menu and wait for it to start! 🐳
