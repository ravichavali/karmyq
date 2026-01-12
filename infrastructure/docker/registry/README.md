# Karmyq Self-Hosted Docker Registry

## Overview
Private Docker registry for storing and serving Karmyq container images.

## Features
- **Authentication**: HTTP Basic Auth with htpasswd
- **Storage**: Local filesystem with delete support
- **Access**: Available at `registry.karmyq.com:5000` or `localhost:5000`
- **Security**: TLS/SSL via nginx reverse proxy

## Setup

### 1. Create Authentication Credentials
```bash
# On production server
docker run --rm --entrypoint htpasswd httpd:2 -Bbn <username> <password> > infrastructure/docker/registry/htpasswd

# Example:
docker run --rm --entrypoint htpasswd httpd:2 -Bbn admin mySecurePassword123 > infrastructure/docker/registry/htpasswd
```

### 2. Start Registry
```bash
docker-compose up -d registry
```

### 3. Verify Registry
```bash
curl -u admin:mySecurePassword123 http://localhost:5000/v2/_catalog
# Should return: {"repositories":[]}
```

## Usage

### Login to Registry
```bash
# On local machine
docker login localhost:5000 -u admin

# On production server
docker login registry.karmyq.com:5000 -u admin
```

### Tag and Push Images
```bash
# Tag image
docker tag karmyq-frontend:latest localhost:5000/karmyq-frontend:v8.1.0

# Push image
docker push localhost:5000/karmyq-frontend:v8.1.0
```

### Pull Images
```bash
docker pull localhost:5000/karmyq-frontend:v8.1.0
```

## Configuration

### Registry Config
- **File**: `infrastructure/docker/registry/config.yml`
- **Storage**: `/var/lib/registry` (persisted via Docker volume)
- **Port**: 5000
- **Auth**: htpasswd file

### Nginx Proxy
The registry is accessible via nginx reverse proxy:
- Local: `http://localhost:5000`
- Production: `https://registry.karmyq.com:5000`

## Maintenance

### List Images in Registry
```bash
curl -u admin:password http://localhost:5000/v2/_catalog
```

### List Tags for an Image
```bash
curl -u admin:password http://localhost:5000/v2/karmyq-frontend/tags/list
```

### Delete Image (if needed)
```bash
# Get digest
curl -I -u admin:password \
  -H "Accept: application/vnd.docker.distribution.manifest.v2+json" \
  http://localhost:5000/v2/karmyq-frontend/manifests/v8.1.0

# Delete by digest
curl -X DELETE -u admin:password \
  http://localhost:5000/v2/karmyq-frontend/manifests/<digest>

# Garbage collect
docker exec karmyq-registry bin/registry garbage-collect /etc/docker/registry/config.yml
```

## Troubleshooting

### Can't Push Images
- Check you're logged in: `docker login localhost:5000`
- Verify credentials in `htpasswd` file
- Check registry logs: `docker logs karmyq-registry`

### Can't Pull Images
- Verify image exists: `curl -u admin:password http://localhost:5000/v2/_catalog`
- Check network connectivity
- Ensure docker daemon trusts insecure registry (if not using HTTPS)

### Storage Full
- Check disk space: `df -h`
- Run garbage collection (see above)
- Clean up old images

## Security Notes

1. **Authentication**: Always use strong passwords in htpasswd
2. **HTTPS**: Production should use SSL/TLS via nginx
3. **Firewall**: Limit registry access to trusted IPs if possible
4. **Backups**: Regularly backup `/var/lib/registry` volume
