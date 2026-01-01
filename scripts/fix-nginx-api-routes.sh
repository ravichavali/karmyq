#!/bin/bash
# Quick fix for nginx API routing on production

echo "======================================"
echo "Fixing Nginx API Routes"
echo "======================================"
echo ""

# Check current nginx config
echo "1. Checking current nginx configuration..."
if [ -f /etc/nginx/sites-available/karmyq.com ]; then
    echo "Found /etc/nginx/sites-available/karmyq.com"

    # Check if API routes are configured
    if grep -q "location /api/auth/" /etc/nginx/sites-available/karmyq.com; then
        echo "✓ API routes are configured"

        # Check the proxy_pass line
        echo ""
        echo "Current auth proxy_pass line:"
        grep -A 1 "location /api/auth/" /etc/nginx/sites-available/karmyq.com

    else
        echo "✗ API routes NOT configured - needs manual setup"
    fi
else
    echo "✗ /etc/nginx/sites-available/karmyq.com not found"
fi

echo ""
echo "2. Checking for proxy_params..."
if [ -f /etc/nginx/proxy_params ]; then
    echo "✓ proxy_params exists"
else
    echo "✗ proxy_params missing - creating it..."
    sudo tee /etc/nginx/proxy_params > /dev/null <<EOF
proxy_set_header Host \$host;
proxy_set_header X-Real-IP \$remote_addr;
proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto \$scheme;
proxy_http_version 1.1;
proxy_set_header Upgrade \$http_upgrade;
proxy_set_header Connection 'upgrade';
proxy_cache_bypass \$http_upgrade;
EOF
    echo "✓ Created /etc/nginx/proxy_params"
fi

echo ""
echo "3. Testing nginx configuration..."
sudo nginx -t

if [ $? -eq 0 ]; then
    echo ""
    echo "4. Reloading nginx..."
    sudo systemctl reload nginx
    echo "✓ Nginx reloaded successfully"
else
    echo "✗ Nginx configuration has errors - NOT reloading"
    exit 1
fi

echo ""
echo "======================================"
echo "Fix Complete - Test Your API Endpoints"
echo "======================================"
echo ""
echo "Test with:"
echo "  curl https://karmyq.com/api/auth/health"
