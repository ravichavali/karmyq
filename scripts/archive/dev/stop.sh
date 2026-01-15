#!/bin/bash

echo "⏹️  Stopping Karmyq Platform..."
cd "$(dirname "$0")/../.." || exit
docker-compose -f infrastructure/docker/docker-compose.yml down
echo "✅ All services stopped"
