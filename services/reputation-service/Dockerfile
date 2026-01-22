# Reputation Service Dockerfile
# Multi-stage build for production

# Build stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY services/reputation-service/package*.json ./
RUN npm install
COPY services/reputation-service/ ./
RUN npm run build

# Production stage
FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
RUN npm install --omit=dev
EXPOSE 3004
CMD ["node", "dist/index.js"]
