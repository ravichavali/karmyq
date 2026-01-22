# Feed Service Dockerfile
# Multi-stage build for production

# Build stage
FROM node:18-alpine AS builder
WORKDIR /app

# Copy service package files
COPY services/feed-service/package*.json ./

# Install dependencies
RUN npm install

# Copy shared modules needed for build (accessible as ../shared from /app/src)
COPY packages/shared ./shared

# Copy service source
COPY services/feed-service/ ./

# Build
RUN npm run build

# Production stage
FROM node:18-alpine
WORKDIR /app

# Copy built files and package files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Install production dependencies only
RUN npm install --omit=dev

EXPOSE 3007
CMD ["node", "dist/src/index.js"]
