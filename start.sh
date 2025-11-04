#!/bin/bash

echo "🚀 Starting Karmyq Platform..."
echo ""
echo "This will start:"
echo "  - PostgreSQL database"
echo "  - Redis event queue"
echo "  - Auth Service (port 3001)"
echo "  - Frontend (port 3000)"
echo "  - Redis Commander (port 8081)"
echo ""
echo "Building and starting services..."
echo ""

docker-compose up --build

