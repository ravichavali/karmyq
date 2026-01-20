# Social Graph Service Dockerfile
# Multi-stage build for production

# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY packages/shared ./node_modules/@karmyq/shared
COPY services/social-graph-service/package*.json ./
RUN npm ci
COPY services/social-graph-service/ ./
RUN npm run build

# Production stage
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules/@karmyq/shared ./node_modules/@karmyq/shared
RUN npm ci --omit=dev
EXPOSE 3010
CMD ["node", "dist/index.js"]
