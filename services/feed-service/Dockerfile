# Feed-service Dockerfile
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

# Copy service source
COPY services/feed-service/ ./services/feed-service/

# Build from service directory
WORKDIR /app/services/feed-service
RUN npm run build

# Production stage
FROM node:18-alpine
WORKDIR /app

# Copy root package.json for hoisted dependencies
COPY package.json package-lock.json* ./

# Copy shared package declaration (needed for workspace)
COPY packages/shared/package*.json ./packages/shared/

# Copy service package files
COPY services/feed-service/package*.json ./services/feed-service/

# Install production dependencies (includes @karmyq/shared)
RUN npm install --omit=dev

# Copy shared module source code (needed at runtime)
COPY packages/shared/ ./packages/shared/

# Copy built files from builder
COPY --from=builder /app/services/feed-service/dist ./services/feed-service/dist

WORKDIR /app/services/feed-service
EXPOSE 3007
CMD ["node", "dist/index.js"]
