# Auth Service Dockerfile
# Multi-stage build for production

# Build stage
FROM node:18-alpine AS builder
RUN apk add --no-cache python3 make g++
WORKDIR /app

# Copy workspace root package.json for hoisted dependencies
COPY package.json package-lock.json* ./

# Copy service package files
COPY services/auth-service/package*.json ./services/auth-service/

# Install dependencies from workspace root (gets hoisted deps)
RUN npm install

# Copy shared modules needed for build
COPY packages/shared ./packages/shared

# Copy service source
COPY services/auth-service/ ./services/auth-service/

# Build from service directory
WORKDIR /app/services/auth-service
RUN npm run build

# Production stage
FROM node:18-alpine
RUN apk add --no-cache python3 make g++
WORKDIR /app

# Copy root package.json for hoisted dependencies
COPY package.json package-lock.json* ./

# Copy service package files
COPY services/auth-service/package*.json ./services/auth-service/

# Install production dependencies
RUN npm install --omit=dev

# Copy built files from builder
COPY --from=builder /app/services/auth-service/dist ./services/auth-service/dist

WORKDIR /app/services/auth-service
EXPOSE 3001
CMD ["node", "dist/index.js"]
