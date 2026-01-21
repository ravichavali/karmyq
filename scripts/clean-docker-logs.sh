#!/bin/bash
set -e

# Clean Docker Container Logs Script
# Truncates Docker container logs to prevent disk space exhaustion

echo "==================================================================="
echo "  Cleaning Docker Container Logs"
echo "==================================================================="
echo ""

# Check current log sizes
echo "📊 Current log sizes:"
total_before=0
for container in $(docker ps -a --format '{{.Names}}'); do
  log_file=$(docker inspect --format='{{.LogPath}}' "$container" 2>/dev/null)
  if [ -f "$log_file" ]; then
    size=$(stat -c%s "$log_file" 2>/dev/null || stat -f%z "$log_file" 2>/dev/null || echo "0")
    size_mb=$((size / 1024 / 1024))
    total_before=$((total_before + size_mb))
    if [ $size_mb -gt 10 ]; then
      echo "  $container: ${size_mb}MB"
    fi
  fi
done
echo "  Total: ${total_before}MB"
echo ""

# Confirm before proceeding
read -p "Truncate all Docker container logs? This will keep containers running. (y/N): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ Cancelled"
  exit 0
fi

echo ""
echo "🧹 Truncating logs..."

# Truncate all container logs
for container in $(docker ps -a --format '{{.Names}}'); do
  log_file=$(docker inspect --format='{{.LogPath}}' "$container" 2>/dev/null)
  if [ -f "$log_file" ]; then
    echo "  Truncating: $container"
    sudo truncate -s 0 "$log_file"
  fi
done

echo ""
echo "✅ Logs truncated"
echo ""

# Check new sizes
echo "📊 New log sizes:"
total_after=0
for container in $(docker ps -a --format '{{.Names}}'); do
  log_file=$(docker inspect --format='{{.LogPath}}' "$container" 2>/dev/null)
  if [ -f "$log_file" ]; then
    size=$(stat -c%s "$log_file" 2>/dev/null || stat -f%z "$log_file" 2>/dev/null || echo "0")
    size_mb=$((size / 1024 / 1024))
    total_after=$((total_after + size_mb))
  fi
done
echo "  Total: ${total_after}MB"
echo ""

# Calculate savings
savings=$((total_before - total_after))
echo "💾 Freed ${savings}MB of disk space"
echo ""

# Recommend log rotation
echo "==================================================================="
echo "  Configure Log Rotation (Recommended)"
echo "==================================================================="
echo ""
echo "Add to /etc/docker/daemon.json:"
echo ""
echo '{'
echo '  "log-driver": "json-file",'
echo '  "log-opts": {'
echo '    "max-size": "10m",'
echo '    "max-file": "3"'
echo '  }'
echo '}'
echo ""
echo "Then restart Docker: sudo systemctl restart docker"
echo ""
