#!/bin/bash

echo "Renewing certificates..."
sudo certbot renew --webroot -w /var/www/certbot --quiet

echo "Reloading Nginx..."
docker compose -f /home/ubuntu/karmyq/infrastructure/docker/docker-compose.prod.yml exec nginx nginx -s reload
