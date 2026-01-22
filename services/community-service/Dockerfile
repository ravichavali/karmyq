# Community Service Dockerfile
# Multi-stage build for production

# Build stage
FROM node:18-alpine AS builder
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY services/community-service/package*.json ./
RUN npm install

# Copy shared modules needed for build (accessible as ../shared from /app/src)
COPY packages/shared ./shared

COPY services/community-service/ ./
RUN npm run build

# Production stage
FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
RUN npm install --omit=dev
EXPOSE 3002
CMD ["node", "dist/index.js"]
