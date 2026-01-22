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

# Copy shared module source files (excluding package.json to avoid workspace conflicts)
# Services import as ../shared/* (from /app/services/X/) and ../../shared/* (from /app/services/X/src/)
RUN mkdir -p ./services/shared ./shared
COPY packages/shared/utils ./services/shared/utils
COPY packages/shared/middleware ./services/shared/middleware
COPY packages/shared/types ./services/shared/types
COPY packages/shared/constants ./services/shared/constants
COPY packages/shared/api ./services/shared/api
COPY packages/shared/utils ./shared/utils
COPY packages/shared/middleware ./shared/middleware
COPY packages/shared/types ./shared/types
COPY packages/shared/constants ./shared/constants
COPY packages/shared/api ./shared/api

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
