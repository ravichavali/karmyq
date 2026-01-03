#!/bin/bash
# Check what containers are actually running

echo "=========================================="
echo "Current Docker Containers"
echo "=========================================="
echo ""

cd ~/karmyq/infrastructure/docker

echo "Running containers:"
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}"

echo ""
echo "All containers (including stopped):"
docker ps -a --format "table {{.Names}}\t{{.Image}}\t{{.Status}}"

echo ""
echo "Docker Compose services defined:"
docker compose -f docker-compose.yml -f docker-compose.prod.yml config --services

echo ""
echo "=========================================="
