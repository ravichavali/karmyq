# Request-service Dockerfile
# Multi-stage build for production with workspace dependencies

# Build stage
FROM node:18-alpine AS builder
WORKDIR /app

# Copy workspace root package.json for hoisted dependencies
COPY package.json package-lock.json* ./

# Copy shared package declaration (needed for workspace)
COPY packages/shared/package*.json ./packages/shared/

# Copy service package files
COPY services/request-service/package*.json ./services/request-service/

# Install dependencies from workspace root (includes @karmyq/shared as workspace)
RUN npm install

# Copy shared module source code
COPY packages/shared/ ./packages/shared/

# Build shared module first
WORKDIR /app/packages/shared
RUN npm run build

# Copy service source
COPY services/request-service/ /app/services/request-service/

# Build service
WORKDIR /app/services/request-service
RUN npm run build

# Production stage
FROM node:18-alpine
WORKDIR /app

# Copy workspace root package.json for hoisted dependencies
COPY package.json package-lock.json* ./

# Copy shared package declaration (needed for workspace)
COPY packages/shared/package*.json ./packages/shared/

# Copy service package files
COPY services/request-service/package*.json ./services/request-service/

# Install production dependencies (includes @karmyq/shared)
RUN npm install --omit=dev

# Copy built shared module from builder (needed at runtime)
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/

# Copy built service files from builder
COPY --from=builder /app/services/request-service/dist ./services/request-service/dist

WORKDIR /app/services/request-service
EXPOSE 3003
CMD ["node", "dist/index.js"]
