# Starting Karmyq on Windows

## Quick Start (3 Steps)

### Step 1: Start Docker Desktop

1. Press `Windows Key` and type "Docker Desktop"
2. Click to open Docker Desktop
3. Wait for the whale icon in system tray to show "Docker Desktop is running" (~30-60 seconds)

### Step 2: Start Karmyq

Open PowerShell or Command Prompt in the Karmyq folder and run:

```powershell
docker compose up --build
```

**Note**: Use `docker compose` (with space), not `docker-compose` (with hyphen)

### Step 3: Access the Application

Wait 1-2 minutes for services to build and start. You'll see:
```
✅ Database connected
✅ Event publisher initialized  
🚀 Auth Service running on port 3001
```

Then open your browser:
- **Frontend**: http://localhost:3000
- **API**: http://localhost:3001/health
- **Redis Commander**: http://localhost:8081

## What to Expect

### First Build (5-10 minutes)
The first time you run `docker compose up --build`, it will:
1. Download Docker images (PostgreSQL, Redis, Node.js)
2. Build your services
3. Install npm packages
4. Start everything

This takes longer the first time. Subsequent starts are much faster (30-60 seconds).

### You'll See Logs Like This:

```
[+] Building 45.2s (12/12) FINISHED
karmyq-postgres      | database system is ready to accept connections
karmyq-redis         | Ready to accept connections
karmyq-auth-service  | ✅ Database connected
karmyq-auth-service  | ✅ Event publisher initialized
karmyq-auth-service  | 🚀 Auth Service running on port 3001
karmyq-frontend      | ready - started server on 0.0.0.0:3000
```

When you see these messages, you're ready to go!

## Common Commands

```powershell
# Start all services (first time or after code changes)
docker compose up --build

# Start without rebuilding (faster, if no code changed)
docker compose up

# Run in background (detached mode)
docker compose up -d

# Stop everything (Ctrl+C if running in foreground, or:)
docker compose down

# View logs
docker compose logs -f

# View logs for one service
docker compose logs -f auth-service

# Restart one service
docker compose restart auth-service

# Stop and remove everything including volumes (fresh start)
docker compose down -v
```

## Troubleshooting

### Issue: "Docker daemon is not running"

**Solution**: Start Docker Desktop from the Start Menu

### Issue: Build fails with npm errors

**Solution**: 
```powershell
# Clean everything and rebuild
docker compose down -v
docker compose up --build
```

### Issue: Port already in use

**Solution**: 
```powershell
# Find what's using the port (e.g., port 3000)
netstat -ano | findstr :3000

# Kill the process (replace PID with the number from above)
taskkill /PID <PID> /F

# Or change the port in docker-compose.yml
```

### Issue: Services won't start

**Solution**:
```powershell
# Check Docker Desktop is running
docker --version

# View detailed logs
docker compose logs

# Restart Docker Desktop
# Right-click Docker icon → Restart
```

## Stopping Karmyq

### If Running in Foreground:
Press `Ctrl + C` in the terminal

### If Running in Background:
```powershell
docker compose down
```

### To Remove All Data:
```powershell
docker compose down -v
```

## File Watching / Hot Reload

Your code changes will automatically reload:
- **Auth Service**: Edit files in `services/auth-service/src/`
- **Frontend**: Edit files in `frontend/src/`

Just save the file and the service will restart automatically!

## What's Running

When you start Karmyq, these containers run:

| Container | Port | Purpose |
|-----------|------|---------|
| karmyq-postgres | 5432 | PostgreSQL database |
| karmyq-redis | 6379 | Redis event queue |
| karmyq-redis-commander | 8081 | Redis GUI |
| karmyq-auth-service | 3001 | Auth API |
| karmyq-frontend | 3000 | Next.js frontend |

## First Time Setup Checklist

- [ ] Docker Desktop installed
- [ ] Docker Desktop running (whale icon in tray)
- [ ] Terminal open in Karmyq folder
- [ ] Run `docker compose up --build`
- [ ] Wait for "ready" messages
- [ ] Open http://localhost:3000
- [ ] Register a new user
- [ ] Login and see dashboard
- [ ] Success! 🎉

## Performance Tips

### Faster Builds
```powershell
# Only rebuild changed services
docker compose up --build auth-service
```

### Free Up Space
```powershell
# Remove unused Docker data
docker system prune -a
```

### View Resource Usage
Open Docker Desktop → Dashboard to see CPU/Memory usage

## Next Steps

Once everything is running:

1. **Test the App**: Register, login, explore
2. **View Events**: Check http://localhost:8081
3. **Test the API**: Use the curl commands in README.md
4. **Build More**: Follow NEXT_STEPS.md

---

**TL;DR**:
1. Start Docker Desktop
2. Run `docker compose up --build`
3. Wait 2 minutes
4. Open http://localhost:3000
5. Start building! 🚀
