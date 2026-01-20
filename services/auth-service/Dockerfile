# Auth Service Dockerfile
# Multi-stage build for production

# Build stage
FROM node:18-alpine AS builder
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY services/auth-service/package*.json ./
RUN npm ci
COPY services/auth-service/ ./
RUN npm run build

# Production stage
FROM node:18-alpine
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev
EXPOSE 3001
CMD ["node", "dist/index.js"]
