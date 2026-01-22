# Cleanup-service Dockerfile
# Multi-stage build for production with workspace dependencies

# Build stage
FROM node:18-alpine AS builder
WORKDIR /app

# Copy workspace root package.json for hoisted dependencies
COPY package.json package-lock.json* ./

# Copy service package files
COPY services/cleanup-service/package*.json ./services/cleanup-service/

# Install dependencies from workspace root (gets hoisted deps)
RUN npm install

# Copy shared modules
COPY packages/shared ./packages/shared

# Copy service source
COPY services/cleanup-service/ ./services/cleanup-service/

# Build from service directory
WORKDIR /app/services/cleanup-service
RUN npm run build

# Production stage
FROM node:18-alpine
WORKDIR /app

# Copy root package.json for hoisted dependencies
COPY package.json package-lock.json* ./

# Copy service package files
COPY services/cleanup-service/package*.json ./services/cleanup-service/

# Install production dependencies
RUN npm install --omit=dev

# Copy built files from builder
COPY --from=builder /app/services/cleanup-service/dist ./services/cleanup-service/dist

WORKDIR /app/services/cleanup-service
EXPOSE 3008
CMD ["node", "dist/index.js"]
