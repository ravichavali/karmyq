#!/bin/bash
set -e

# Setup Docker Log Rotation
# Configures Docker daemon to automatically rotate logs and prevent disk exhaustion

echo "==================================================================="
echo "  Setup Docker Log Rotation"
echo "==================================================================="
echo ""

DOCKER_DAEMON_FILE="/etc/docker/daemon.json"

# Check if file exists
if [ ! -f "$DOCKER_DAEMON_FILE" ]; then
  echo "📝 Creating new $DOCKER_DAEMON_FILE"
  sudo tee "$DOCKER_DAEMON_FILE" > /dev/null <<EOF
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF
else
  echo "⚠️  $DOCKER_DAEMON_FILE already exists"
  echo ""
  echo "Current contents:"
  sudo cat "$DOCKER_DAEMON_FILE"
  echo ""

  read -p "Merge log rotation settings? (y/N): " -n 1 -r
  echo ""

  if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Backup current file
    sudo cp "$DOCKER_DAEMON_FILE" "$DOCKER_DAEMON_FILE.backup"
    echo "✅ Backed up to $DOCKER_DAEMON_FILE.backup"

    # Merge settings (requires jq)
    if command -v jq &> /dev/null; then
      sudo jq '. + {"log-driver": "json-file", "log-opts": {"max-size": "10m", "max-file": "3"}}' \
        "$DOCKER_DAEMON_FILE" | sudo tee "$DOCKER_DAEMON_FILE.tmp" > /dev/null
      sudo mv "$DOCKER_DAEMON_FILE.tmp" "$DOCKER_DAEMON_FILE"
      echo "✅ Merged log rotation settings"
    else
      echo "❌ jq not installed. Manual merge required."
      echo ""
      echo "Add these settings to $DOCKER_DAEMON_FILE:"
      echo '  "log-driver": "json-file",'
      echo '  "log-opts": {'
      echo '    "max-size": "10m",'
      echo '    "max-file": "3"'
      echo '  }'
      exit 1
    fi
  else
    echo "❌ Cancelled"
    exit 0
  fi
fi

echo ""
echo "✅ Docker log rotation configured:"
echo "   - Max log size: 10MB per file"
echo "   - Max files: 3 (30MB total per container)"
echo ""

# Restart Docker
read -p "Restart Docker daemon to apply changes? (y/N): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "🔄 Restarting Docker daemon..."
  sudo systemctl restart docker

  # Wait for Docker to start
  sleep 3

  # Check Docker status
  if sudo systemctl is-active --quiet docker; then
    echo "✅ Docker daemon restarted successfully"
  else
    echo "❌ Docker failed to start. Check logs: sudo journalctl -u docker"
    exit 1
  fi

  echo ""
  echo "🐳 Restarting containers..."
  cd ~/karmyq
  docker compose \
    -f infrastructure/docker/docker-compose.yml \
    -f infrastructure/docker/docker-compose.prod.yml \
    up -d

  echo "✅ Containers restarted with new log rotation settings"
else
  echo ""
  echo "⚠️  Changes will take effect after Docker restart"
  echo "   Run: sudo systemctl restart docker"
fi

echo ""
echo "==================================================================="
echo "  PM2 Log Rotation (Optional)"
echo "==================================================================="
echo ""
echo "Install pm2-logrotate module:"
echo "  pm2 install pm2-logrotate"
echo ""
echo "Configure rotation:"
echo "  pm2 set pm2-logrotate:max_size 10M"
echo "  pm2 set pm2-logrotate:retain 3"
echo "  pm2 set pm2-logrotate:compress true"
echo ""
