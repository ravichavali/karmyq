# Messaging-service Dockerfile
# Multi-stage build for production with workspace dependencies

# Build stage
FROM node:18-alpine AS builder
WORKDIR /app

# Copy workspace root package.json for hoisted dependencies
COPY package.json package-lock.json* ./

# Copy service package files
COPY services/messaging-service/package*.json ./services/messaging-service/

# Install dependencies from workspace root (gets hoisted deps)
RUN npm install

# Copy shared modules
COPY packages/shared ./packages/shared

# Copy service source
COPY services/messaging-service/ ./services/messaging-service/

# Create symlinks so relative imports can find shared modules
# Services import as ../shared/* and ../../shared/*
RUN ln -s /app/packages/shared /app/services/shared && \
    ln -s /app/packages/shared /app/shared

# Build from service directory
WORKDIR /app/services/messaging-service
RUN npm run build

# Production stage
FROM node:18-alpine
WORKDIR /app

# Copy root package.json for hoisted dependencies
COPY package.json package-lock.json* ./

# Copy service package files
COPY services/messaging-service/package*.json ./services/messaging-service/

# Install production dependencies
RUN npm install --omit=dev

# Copy built files from builder
COPY --from=builder /app/services/messaging-service/dist ./services/messaging-service/dist

WORKDIR /app/services/messaging-service
EXPOSE 3006
CMD ["node", "dist/index.js"]
