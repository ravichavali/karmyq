FROM node:20-alpine

WORKDIR /app

# Copy shared package first
COPY packages/shared ./node_modules/@karmyq/shared

# Copy service package files
COPY services/social-graph-service/package*.json ./

# Install dependencies
RUN npm install

# Copy service source code
COPY services/social-graph-service/src ./src
COPY services/social-graph-service/tsconfig.json* ./

# Expose port
EXPOSE 3010

# Start service (dev mode with tsx)
CMD ["npm", "run", "dev"]
