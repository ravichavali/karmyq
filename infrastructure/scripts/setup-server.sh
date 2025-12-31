#!/bin/bash

# setup-server.sh
# Universal setup script for Karmyq (OCI Production & Staging)
# Tested on Ubuntu 20.04/22.04 LTS

set -e

echo "🚀 Starting Karmyq Server Setup..."

# 1. Update System
echo "📦 Updating system packages..."
sudo apt-get update && sudo apt-get upgrade -y

# 2. Install Essentials
echo "🛠️ Installing essential tools..."
sudo apt-get install -y curl wget git unzip htop ufw fail2ban nginx certbot python3-certbot-nginx

# 3. Install Docker & Docker Compose
if ! command -v docker &> /dev/null; then
    echo "🐳 Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    
    # Add current user to docker group
    sudo usermod -aG docker $USER
    echo "✅ Docker installed. User $USER added to docker group."
else
    echo "✅ Docker already installed."
fi

# 4. Configure Firewall (UFW)
echo "🛡️ Configuring Firewall..."
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https
# Enable UFW non-interactively
echo "y" | sudo ufw enable
echo "✅ Firewall configured."

# 5. Create karmyq user
echo "👤 Creating 'karmyq' user..."
if id "karmyq" &>/dev/null; then
    echo "✅ User 'karmyq' already exists."
else
    # Create user with home directory and bash shell
    sudo useradd -m -s /bin/bash karmyq
    # Add to sudo group (optional, but useful for ops)
    sudo usermod -aG sudo karmyq
    # Add to docker group
    sudo usermod -aG docker karmyq
    # Set password (interactive or random?) -> Let's set a placeholder and ask user to change it, 
    # OR simpler: relying on key-based auth which assumes authorized_keys copied.
    # For now, we will just say:
    echo "✅ User 'karmyq' created."
    echo "⚠️  IMPORTANT: Set a password for 'karmyq' with: sudo passwd karmyq"
    echo "⚠️  IMPORTANT: Copy your SSH key to /home/karmyq/.ssh/authorized_keys"
fi

# 6. Directory Structure (owned by karmyq)
echo "📂 Creating directory structure..."
# We create it in karmyq's home
APP_DIR="/home/karmyq/karmyq"
sudo -u karmyq mkdir -p $APP_DIR/config
sudo -u karmyq mkdir -p $APP_DIR/logs
sudo -u karmyq mkdir -p $APP_DIR/scripts

echo "✨ Server Setup Complete!"
echo "➡️  Next Steps:"
echo "1. Set password for karmyq: 'sudo passwd karmyq'"
echo "2. Switch to karmyq user: 'su - karmyq'"
echo "3. Clone repository to $APP_DIR"
echo "4. Run 'infrastructure/scripts/deploy.sh'"
