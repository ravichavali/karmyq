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
COPY services/geocoding-service/src ./services/geocoding-service/src

# Production stage
FROM node:18-alpine
WORKDIR /app

# Run as non-root user (node user is built into node:alpine images)
RUN chown node:node /app
USER node

# Copy service package.json
COPY --chown=node:node services/geocoding-service/package*.json ./

# Install production dependencies (NOT as workspace - standalone service)
RUN npm install --omit=dev

# Copy service source
COPY --chown=node:node --from=builder /app/services/geocoding-service/index.js ./index.js
COPY --chown=node:node --from=builder /app/services/geocoding-service/src ./src

EXPOSE 3009
ENTRYPOINT []
CMD ["node", "./index.js"]
