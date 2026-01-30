# Geocoding Service Dockerfile
# Simple build for JavaScript-only service (no TypeScript, no shared package dependency)

# Build stage
FROM node:18-alpine AS builder
WORKDIR /app

# Copy workspace root package.json for workspace context
COPY package.json package-lock.json* ./

# Copy service package files
COPY services/geocoding-service/package*.json ./services/geocoding-service/

# Install all dependencies (for workspace resolution)
RUN npm install

# Copy service source
COPY services/geocoding-service/index.js ./services/geocoding-service/index.js

# Production stage
FROM node:18-alpine
WORKDIR /app/services/geocoding-service

# Copy service package.json
COPY services/geocoding-service/package*.json ./

# Install production dependencies (NOT as workspace - standalone service)
RUN npm install --omit=dev

# Copy service source
COPY --from=builder /app/services/geocoding-service/index.js ./index.js

EXPOSE 3009
ENTRYPOINT []
CMD ["node", "./index.js"]
