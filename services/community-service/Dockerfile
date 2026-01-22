# Community-service Dockerfile
# Multi-stage build for production with workspace dependencies

# Build stage
FROM node:18-alpine AS builder
WORKDIR /app

# Copy workspace root package.json for hoisted dependencies
COPY package.json package-lock.json* ./

# Copy service package files
COPY services/community-service/package*.json ./services/community-service/

# Install dependencies from workspace root (gets hoisted deps)
RUN npm install

# Copy shared modules
COPY packages/shared ./packages/shared

# Copy service source
COPY services/community-service/ ./services/community-service/

# Build from service directory
WORKDIR /app/services/community-service
RUN npm run build

# Production stage
FROM node:18-alpine
WORKDIR /app

# Copy root package.json for hoisted dependencies
COPY package.json package-lock.json* ./

# Copy service package files
COPY services/community-service/package*.json ./services/community-service/

# Install production dependencies
RUN npm install --omit=dev

# Copy built files from builder
COPY --from=builder /app/services/community-service/dist ./services/community-service/dist

WORKDIR /app/services/community-service
EXPOSE 3002
CMD ["node", "dist/index.js"]
