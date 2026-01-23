# Notification-service Dockerfile
# Multi-stage build for production with workspace dependencies

# Build stage
FROM node:18-alpine AS builder
WORKDIR /app

# Copy workspace root package.json for hoisted dependencies
COPY package.json package-lock.json* ./

# Copy shared package declaration (needed for workspace)
COPY packages/shared/package*.json ./packages/shared/

# Copy service package files
COPY services/notification-service/package*.json ./services/notification-service/

# Install dependencies from workspace root (includes @karmyq/shared as workspace)
RUN npm install

# Copy shared module source code
COPY packages/shared/ ./packages/shared/

# Build shared module first
WORKDIR /app/packages/shared
RUN npm run build

# Copy service source
COPY services/notification-service/ /app/services/notification-service/

# Build service
WORKDIR /app/services/notification-service
RUN npm run build

# Production stage
FROM node:18-alpine
WORKDIR /app

# Copy workspace root package.json for hoisted dependencies
COPY package.json package-lock.json* ./

# Copy shared package declaration (needed for workspace)
COPY packages/shared/package*.json ./packages/shared/

# Copy service package files
COPY services/notification-service/package*.json ./services/notification-service/

# Install production dependencies (includes @karmyq/shared)
RUN npm install --omit=dev

# Copy built shared module from builder (needed at runtime)
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/

# Copy built service files from builder
COPY --from=builder /app/services/notification-service/dist ./services/notification-service/dist

WORKDIR /app/services/notification-service
EXPOSE 3005
CMD ["node", "dist/index.js"]
