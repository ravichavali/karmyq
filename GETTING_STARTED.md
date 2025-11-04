# Getting Started with Karmyq

Welcome! This guide will get you up and running with Karmyq in under 5 minutes.

## Prerequisites

You only need:
- **Docker Desktop** installed ([Download here](https://www.docker.com/products/docker-desktop))
- That's it! Docker handles everything else.

## Step 1: Start the Platform (60 seconds)

```bash
# Start all services
docker-compose up --build

# You'll see services starting:
# ✓ PostgreSQL database
# ✓ Redis event queue
# ✓ Auth Service
# ✓ Frontend
```

Wait until you see:
```
✅ Database connected
✅ Event publisher initialized
🚀 Auth Service running on port 3001
```

## Step 2: Open Your Browser

Visit: **http://localhost:3000**

You should see the Karmyq homepage!

## Step 3: Create Your First Account

1. Click "Get Started" or "Register"
2. Fill in your details:
   - Name: Your name
   - Email: test@example.com
   - Password: password123 (minimum 8 characters)
3. Click "Create Account"
4. You'll be redirected to your dashboard!

## Step 4: Explore the Platform

### Frontend
- **Homepage**: http://localhost:3000
- **Register**: http://localhost:3000/register
- **Login**: http://localhost:3000/login
- **Dashboard**: http://localhost:3000/dashboard (requires login)

### Backend API
- **Auth Service**: http://localhost:3001
- **Health Check**: http://localhost:3001/health

### Development Tools
- **Redis Commander**: http://localhost:8081
  - View the event queue
  - See published events in real-time
  - Username: (leave blank), Password: (leave blank)

## Step 5: Test the API (Optional)

### Register via API
```bash
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "api@example.com",
    "name": "API User",
    "password": "securepassword"
  }'
```

### Login via API
```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "api@example.com",
    "password": "securepassword"
  }'
```

You'll receive a JWT token in the response!

## Common Commands

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f auth-service
docker-compose logs -f frontend
```

### Restart a Service
```bash
docker-compose restart auth-service
```

### Stop Everything
```bash
# Stop but keep data
docker-compose down

# Stop and remove all data
docker-compose down -v
```

### Rebuild After Code Changes
```bash
docker-compose up --build
```

## What's Working?

- ✅ User registration
- ✅ User login with JWT tokens
- ✅ Protected dashboard
- ✅ Event publishing system (check Redis Commander!)
- ✅ Database with all schemas ready
- ✅ Responsive UI with Tailwind CSS

## What's Next?

Now that you have the foundation running:

1. **Explore the Code**
   - `services/auth-service/` - Authentication service
   - `frontend/` - Next.js frontend
   - `infrastructure/postgres/init.sql` - Database schemas

2. **Build More Features**
   - Community Service (create communities)
   - Request Service (post help requests)
   - Reputation Service (karma system)

3. **Read the Docs**
   - [Architecture Overview](Context/ARCHITECTURE.md)
   - [Service Development Guide](Context/SERVICE_GUIDE.md)

## Troubleshooting

### "Port already in use"
```bash
# Stop whatever is using the port, or change ports in docker-compose.yml
docker-compose down
```

### "Database connection failed"
```bash
# Wait 10-15 seconds for PostgreSQL to fully start
# Check database logs
docker-compose logs postgres
```

### "Frontend not loading"
```bash
# Check if build completed
docker-compose logs frontend

# Rebuild
docker-compose up --build frontend
```

### "Cannot connect to Redis"
```bash
# Check Redis status
docker-compose logs redis
```

## Success Indicators

You know everything is working when:

1. ✅ Frontend loads at http://localhost:3000
2. ✅ You can register and login
3. ✅ Dashboard shows your name
4. ✅ Redis Commander shows events at http://localhost:8081
5. ✅ Auth service health check responds at http://localhost:3001/health

## Need Help?

- Check the [README.md](README.md)
- Review [Context/ARCHITECTURE.md](Context/ARCHITECTURE.md)
- Look at service code for examples

---

**You're all set! Start building the future of community mutual aid.** 🚀
