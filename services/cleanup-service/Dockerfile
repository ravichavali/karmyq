# Cleanup Service Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy service package files (from repo root context)
COPY services/cleanup-service/package*.json ./
COPY services/cleanup-service/tsconfig.json ./
RUN npm install

# Copy service source
COPY services/cleanup-service/src ./src

# Build TypeScript
RUN npm run build

EXPOSE 3008

CMD ["npm", "start"]
