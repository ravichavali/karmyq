# Frontend Dockerfile
# Multi-stage build with @karmyq/shared workspace dependency

# Build stage
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy workspace root package.json for hoisted dependencies
COPY package.json package-lock.json* ./

# Copy shared package declaration (needed for workspace)
COPY packages/shared/package*.json ./packages/shared/

# Copy frontend package files
COPY apps/frontend/package*.json ./apps/frontend/

# Install dependencies from workspace root (includes @karmyq/shared as workspace)
RUN npm install

# Copy shared module source code and build it first
COPY packages/shared/ ./packages/shared/

# Remove platform-specific and client-only files before build
RUN rm -f ./packages/shared/api/client.ts \
           ./packages/shared/api/mobile-storage.ts \
           ./packages/shared/api/web-storage.ts

WORKDIR /app/packages/shared
RUN npm run build

# Copy frontend source
COPY apps/frontend/ /app/apps/frontend/

# Build Next.js
WORKDIR /app/apps/frontend

# Set NODE_ENV=production so Next.js reads .env.production
ENV NODE_ENV=production

# Build-time environment variables (override .env.production if passed)
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_COMMUNITY_API_URL
ARG NEXT_PUBLIC_REQUEST_API_URL
ARG NEXT_PUBLIC_REPUTATION_API_URL
ARG NEXT_PUBLIC_NOTIFICATION_API_URL
ARG NEXT_PUBLIC_MESSAGING_API_URL
ARG NEXT_PUBLIC_SOCIAL_GRAPH_API_URL

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_COMMUNITY_API_URL=$NEXT_PUBLIC_COMMUNITY_API_URL
ENV NEXT_PUBLIC_REQUEST_API_URL=$NEXT_PUBLIC_REQUEST_API_URL
ENV NEXT_PUBLIC_REPUTATION_API_URL=$NEXT_PUBLIC_REPUTATION_API_URL
ENV NEXT_PUBLIC_NOTIFICATION_API_URL=$NEXT_PUBLIC_NOTIFICATION_API_URL
ENV NEXT_PUBLIC_MESSAGING_API_URL=$NEXT_PUBLIC_MESSAGING_API_URL
ENV NEXT_PUBLIC_SOCIAL_GRAPH_API_URL=$NEXT_PUBLIC_SOCIAL_GRAPH_API_URL

ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# Production image
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/frontend/public ./public

RUN mkdir .next
RUN chown nextjs:nodejs .next

# Standalone output nests under apps/frontend/ when built from workspace root
# Copy root-level deps (node_modules, package.json)
COPY --from=builder --chown=nextjs:nodejs /app/apps/frontend/.next/standalone/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/apps/frontend/.next/standalone/package.json ./package.json
# Copy the app-level server and deps
COPY --from=builder --chown=nextjs:nodejs /app/apps/frontend/.next/standalone/apps/frontend/ ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/frontend/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000

CMD ["node", "server.js"]
