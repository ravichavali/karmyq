# Service Dockerfile
# Multi-stage build for production with workspace dependencies

# Build stage
FROM node:18-alpine AS builder
WORKDIR /app

# Copy workspace root package.json for hoisted dependencies
COPY package.json package-lock.json* ./

# Copy shared package declaration (needed for workspace)
COPY packages/shared/package*.json ./packages/shared/

# Copy service package files
COPY services/feed-service/package*.json ./services/feed-service/

# Install dependencies from workspace root (includes @karmyq/shared as workspace)
RUN npm install

# Copy shared module source code
COPY packages/shared/ ./packages/shared/

# Remove platform-specific and client-only files before build
RUN rm -f ./packages/shared/api/client.ts \
           ./packages/shared/api/mobile-storage.ts \
           ./packages/shared/api/web-storage.ts

# Build shared module first
WORKDIR /app/packages/shared
RUN npm run build

# Copy service source
COPY services/feed-service/ /app/services/feed-service/

# Build service
WORKDIR /app/services/feed-service
RUN npm run build

# Production stage
FROM node:18-alpine
WORKDIR /app

# Copy workspace root package.json for hoisted dependencies
COPY package.json package-lock.json* ./

# Copy built shared module BEFORE npm install (so workspace sees compiled files)
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

# Copy service package files
COPY services/feed-service/package*.json ./services/feed-service/

# Install production dependencies (includes @karmyq/shared workspace with dist/ already present)
RUN npm install --omit=dev

# Copy built service files from builder
COPY --from=builder /app/services/feed-service/dist ./services/feed-service/dist

WORKDIR /app/services/feed-service
EXPOSE 3007
CMD ["node", "dist/index.js"]
