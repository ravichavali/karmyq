#!/bin/bash

# Start Development Services for Karmyq
# Starts: PostgreSQL, Redis, Request Service, Auth Service, Community Service
# Usage: ./start-dev-services.sh

set -e  # Exit on error

echo "🚀 Starting Karmyq Development Services..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if port is in use
check_port() {
    local port=$1
    local service=$2

    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Port $port already in use ($service might be running)${NC}"
        return 1
    else
        echo -e "${GREEN}✓ Port $port is available${NC}"
        return 0
    fi
}

# Function to start a service
start_service() {
    local service_name=$1
    local service_dir=$2
    local port=$3

    echo ""
    echo -e "${YELLOW}Starting $service_name...${NC}"

    if [ -d "$service_dir" ]; then
        cd "$service_dir"

        # Check if node_modules exists
        if [ ! -d "node_modules" ]; then
            echo -e "${YELLOW}Installing dependencies...${NC}"
            npm install
        fi

        # Start service in background
        nohup npm run dev > ../logs/${service_name}.log 2>&1 &
        local pid=$!

        echo -e "${GREEN}✓ $service_name started (PID: $pid, Port: $port)${NC}"

        # Wait a moment and check if still running
        sleep 3
        if ps -p $pid > /dev/null; then
            echo -e "${GREEN}✓ $service_name is running${NC}"
        else
            echo -e "${RED}✗ $service_name failed to start${NC}"
            return 1
        fi
    else
        echo -e "${RED}✗ Directory not found: $service_dir${NC}"
        return 1
    fi
}

# Create logs directory
mkdir -p logs

# Check Docker Desktop (for Windows users)
echo ""
echo -e "${YELLOW}Checking Docker Desktop...${NC}"
if command -v docker &> /dev/null; then
    if docker ps | grep -q "postgres"; then
        echo -e "${GREEN}✓ PostgreSQL container is running${NC}"
    else
        echo -e "${YELLOW}Starting PostgreSQL and Redis containers...${NC}"
        if docker compose up -d postgres redis; then
            echo -e "${GREEN}✓ PostgreSQL and Redis started${NC}"
        else
            echo -e "${YELLOW}Trying docker-compose instead...${NC}"
            docker-compose up -d postgres redis
        fi
    fi
else
    echo -e "${YELLOW}⚠️  Docker command not found. Please start Docker Desktop manually:${NC}"
    echo -e "${YELLOW}   1. Open Docker Desktop${NC}"
    echo -e "${YELLOW}   2. Go to 'Containers' tab${NC}"
    echo -e "${YELLOW}   3. Start 'postgres' and 'redis' containers${NC}"
    echo ""
    read -p "Press Enter once containers are started..." -r
fi

# Wait for services to be ready
echo ""
echo -e "${YELLOW}Waiting for services to be ready...${NC}"
sleep 5

# Check ports
check_port 5432 "PostgreSQL"
check_port 6379 "Redis"
check_port 3001 "Auth Service"
check_port 3002 "Community Service"
check_port 3003 "Request Service"

# Start services in parallel
echo ""
echo -e "${GREEN}🔧 Starting backend services...${NC}"

# Auth Service
start_service "auth-service" "services/auth-service" 3001 &

# Community Service
start_service "community-service" "services/community-service" 3002 &

# Request Service
start_service "request-service" "services/request-service" 3003 &

# Wait for all services to start
wait

# Final check
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ All services started!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Services running:"
echo "  - PostgreSQL (port 5432)"
echo "  - Redis (port 6379)"
echo "  - Auth Service (port 3001)"
echo "  - Community Service (port 3002)"
echo "  - Request Service (port 3003)"
echo ""
echo "Logs available in: ./logs/"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"

# Function to kill services on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 Stopping all services...${NC}"
    pkill -f "npm run dev" || true
    echo -e "${GREEN}✓ All services stopped${NC}"
    exit 0
}

# Trap signals for cleanup
trap cleanup SIGINT SIGTERM

# Keep script running
while true; do
    sleep 1
done
