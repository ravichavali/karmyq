# Social Graph Service Dockerfile
# Multi-stage build for production

# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

# Copy workspace root package.json for hoisted dependencies
COPY package.json package-lock.json* ./

# Copy service package files
COPY services/social-graph-service/package*.json ./services/social-graph-service/

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
COPY services/social-graph-service/ ./services/social-graph-service/

# Build from service directory
WORKDIR /app/services/social-graph-service
RUN npm run build

# Production stage
FROM node:20-alpine
WORKDIR /app

# Copy root package.json for hoisted dependencies
COPY package.json package-lock.json* ./

# Copy service package files
COPY services/social-graph-service/package*.json ./services/social-graph-service/

# Install production dependencies
RUN npm install --omit=dev

# Copy built files from builder
COPY --from=builder /app/services/social-graph-service/dist ./services/social-graph-service/dist

WORKDIR /app/services/social-graph-service
EXPOSE 3010
CMD ["node", "dist/index.js"]
