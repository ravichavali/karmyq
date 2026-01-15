# Frontend-only Dockerfile
# Builds ONLY Next.js frontend, not the entire monorepo

FROM node:18-alpine AS base

# Install dependencies
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy ONLY frontend package files (from repo root context)
COPY apps/frontend/package.json apps/frontend/package-lock.json* ./
RUN npm install

# Build stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules

# Copy ONLY frontend source (from repo root context)
COPY apps/frontend/ ./

# Build-time environment variables
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_COMMUNITY_API_URL
ARG NEXT_PUBLIC_REQUEST_API_URL
ARG NEXT_PUBLIC_REPUTATION_API_URL
ARG NEXT_PUBLIC_NOTIFICATION_API_URL
ARG NEXT_PUBLIC_MESSAGING_API_URL
ARG NEXT_PUBLIC_FEED_API_URL
ARG NEXT_PUBLIC_SOCIAL_GRAPH_API_URL

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_COMMUNITY_API_URL=$NEXT_PUBLIC_COMMUNITY_API_URL
ENV NEXT_PUBLIC_REQUEST_API_URL=$NEXT_PUBLIC_REQUEST_API_URL
ENV NEXT_PUBLIC_REPUTATION_API_URL=$NEXT_PUBLIC_REPUTATION_API_URL
ENV NEXT_PUBLIC_NOTIFICATION_API_URL=$NEXT_PUBLIC_NOTIFICATION_API_URL
ENV NEXT_PUBLIC_MESSAGING_API_URL=$NEXT_PUBLIC_MESSAGING_API_URL
ENV NEXT_PUBLIC_FEED_API_URL=$NEXT_PUBLIC_FEED_API_URL
ENV NEXT_PUBLIC_SOCIAL_GRAPH_API_URL=$NEXT_PUBLIC_SOCIAL_GRAPH_API_URL

ENV NEXT_TELEMETRY_DISABLED=1

# Build Next.js directly (NOT via Turborepo)
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

RUN mkdir .next
RUN chown nextjs:nodejs .next

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000

CMD ["node", "server.js"]
