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

# Copy shared modules needed for build
COPY packages/shared ./packages/shared

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
