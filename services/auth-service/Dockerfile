# Auth Service Dockerfile
# Builds ONLY auth-service, not the entire monorepo

FROM node:18-alpine

# Install build dependencies for native modules (bcrypt)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy ONLY auth-service package files (from repo root context)
COPY services/auth-service/package*.json ./
RUN npm install

# Copy ONLY auth-service source
COPY services/auth-service/ ./

EXPOSE 3001

CMD ["npm", "run", "dev"]
