#!/bin/bash

# Exit on error
set -e

echo "Starting Production Server Setup..."

# 1. Update System
echo "Updating system..."
sudo apt-get update
sudo apt-get upgrade -y

# 2. Install Dependencies
echo "Installing dependencies..."
sudo apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    git \
    ufw

# 3. Install Docker
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    sudo mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    
    # Add user to docker group
    sudo usermod -aG docker $USER
    echo "Docker installed. You may need to logout and login again for group changes to take effect."
else
    echo "Docker already installed."
fi

# 4. Install Certbot
if ! command -v certbot &> /dev/null; then
    echo "Installing Certbot..."
    sudo apt-get install -y certbot python3-certbot-nginx
    # create webroot for letsencrypt
    sudo mkdir -p /var/www/certbot
else
    echo "Certbot already installed."
fi

# 5. Configure Firewall (UFW)
echo "Configuring Firewall..."
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
# Enable UFW (non-interactive)
echo "y" | sudo ufw enable

# 6. Verify Memory / Swap
# If RAM is < 2GB, add swap. (OCI A1 usually has 24GB, so this might be skipped, but good safety)
TOTAL_MEM=$(grep MemTotal /proc/meminfo | awk '{print $2}')
if [ "$TOTAL_MEM" -lt 2000000 ]; then
    echo "Low memory detected. Checking for swap..."
    if [ $(swapon --show | wc -l) -eq 0 ]; then
        echo "Creating 4GB swap file..."
        sudo fallocate -l 4G /swapfile
        sudo chmod 600 /swapfile
        sudo mkswap /swapfile
        sudo swapon /swapfile
        echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    fi
fi

echo "Setup Complete!"
echo "Please logout and log back in to use Docker commands without sudo."
