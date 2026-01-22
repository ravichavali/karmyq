# Notification-service Dockerfile
# Multi-stage build for production with workspace dependencies

# Build stage
FROM node:18-alpine AS builder
WORKDIR /app

# Copy workspace root package.json for hoisted dependencies
COPY package.json package-lock.json* ./

# Copy service package files
COPY services/notification-service/package*.json ./services/notification-service/

# Install dependencies from workspace root (gets hoisted deps)
RUN npm install

# Copy shared modules to multiple locations for relative imports
# Services import as ../shared/* (from /app/services/X/) and ../../shared/* (from /app/services/X/src/)
COPY packages/shared ./services/shared
COPY packages/shared ./shared

# Copy service source
COPY services/notification-service/ ./services/notification-service/

# Build from service directory
WORKDIR /app/services/notification-service
RUN npm run build

# Production stage
FROM node:18-alpine
WORKDIR /app

# Copy root package.json for hoisted dependencies
COPY package.json package-lock.json* ./

# Copy service package files
COPY services/notification-service/package*.json ./services/notification-service/

# Install production dependencies
RUN npm install --omit=dev

# Copy built files from builder
COPY --from=builder /app/services/notification-service/dist ./services/notification-service/dist

WORKDIR /app/services/notification-service
EXPOSE 3005
CMD ["node", "dist/index.js"]
