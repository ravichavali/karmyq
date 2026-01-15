#!/bin/bash
# Check nginx configuration for karmyq.com

echo "======================================"
echo "Nginx Configuration Check"
echo "======================================"
echo ""

echo "1. Checking nginx configuration files..."
echo "--- Main nginx.conf ---"
sudo cat /etc/nginx/nginx.conf
echo ""

echo "--- Sites available ---"
ls -la /etc/nginx/sites-available/
echo ""

echo "--- Sites enabled ---"
ls -la /etc/nginx/sites-enabled/
echo ""

echo "2. Checking karmyq site config..."
if [ -f /etc/nginx/sites-available/karmyq ]; then
    sudo cat /etc/nginx/sites-available/karmyq
elif [ -f /etc/nginx/sites-available/karmyq.com ]; then
    sudo cat /etc/nginx/sites-available/karmyq.com
elif [ -f /etc/nginx/sites-available/default ]; then
    echo "Using default config:"
    sudo cat /etc/nginx/sites-available/default
else
    echo "No site config found!"
fi
echo ""

echo "3. Testing nginx configuration..."
sudo nginx -t
echo ""

echo "4. Checking nginx error log..."
sudo tail -50 /var/log/nginx/error.log
echo ""

echo "5. Checking nginx access log..."
sudo tail -20 /var/log/nginx/access.log
echo ""

echo "6. Testing backend connectivity from nginx perspective..."
echo "--- Testing localhost:3000 (frontend) ---"
curl -v http://localhost:3000 2>&1 | head -20
echo ""

echo "--- Testing localhost:3001/health (auth service) ---"
curl -v http://localhost:3001/health 2>&1
echo ""

echo "7. Checking if services are listening..."
sudo netstat -tlnp | grep -E ':(3000|3001|3002|3003|3004|3005|3006|3007|3008|3009|3010)'
echo ""

echo "======================================"
echo "Check Complete"
echo "======================================"
