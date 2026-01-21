#!/bin/bash
set -e

# Check Storage Usage Script
# Analyzes disk usage on production server and identifies cleanup opportunities

echo "==================================================================="
echo "  Karmyq Production Server - Storage Analysis"
echo "==================================================================="
echo ""

# Overall disk usage
echo "📊 Overall Disk Usage:"
df -h /
echo ""

# Docker specific usage
echo "🐳 Docker Disk Usage:"
docker system df
echo ""

# Docker logs size
echo "📝 Docker Container Logs Size:"
for container in $(docker ps -a --format '{{.Names}}'); do
  log_file=$(docker inspect --format='{{.LogPath}}' "$container" 2>/dev/null)
  if [ -f "$log_file" ]; then
    size=$(du -h "$log_file" | cut -f1)
    echo "  $container: $size"
  fi
done
echo ""

# Total log size
echo "📊 Total Docker Logs Size:"
total_size=$(du -sh /var/lib/docker/containers/*/\*-json.log 2>/dev/null | awk '{sum+=$1} END {print sum}')
echo "  Total: ${total_size:-0} MB"
echo ""

# PM2 logs
echo "📝 PM2 Logs Size:"
if [ -d "$HOME/.pm2/logs" ]; then
  du -sh "$HOME/.pm2/logs"
  echo "  Files:"
  find "$HOME/.pm2/logs" -type f -exec du -h {} \; | sort -rh | head -10
else
  echo "  No PM2 logs directory found"
fi
echo ""

# Application logs
echo "📝 Application Logs:"
if [ -d "$HOME/karmyq/services/simulation-service/logs" ]; then
  du -sh "$HOME/karmyq/services/simulation-service/logs"
fi
echo ""

# Docker images
echo "🖼️  Docker Images:"
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"
echo ""

# Docker volumes
echo "💾 Docker Volumes:"
docker volume ls -q | xargs docker volume inspect --format '{{.Name}}: {{.Mountpoint}}' | while read line; do
  name=$(echo "$line" | cut -d: -f1)
  path=$(echo "$line" | cut -d: -f2-)
  if [ -d "$path" ]; then
    size=$(sudo du -sh "$path" 2>/dev/null | cut -f1)
    echo "  $name: $size"
  fi
done
echo ""

# Recommendations
echo "==================================================================="
echo "  Cleanup Recommendations"
echo "==================================================================="
echo ""
echo "1. Clean Docker logs:"
echo "   ./scripts/clean-docker-logs.sh"
echo ""
echo "2. Clean PM2 logs:"
echo "   pm2 flush"
echo ""
echo "3. Remove unused Docker images:"
echo "   docker image prune -a --filter 'until=24h'"
echo ""
echo "4. Remove unused Docker volumes:"
echo "   docker volume prune -f"
echo ""
echo "5. Clean Docker build cache:"
echo "   docker builder prune -a -f"
echo ""
