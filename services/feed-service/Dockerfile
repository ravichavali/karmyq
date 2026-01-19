# Feed Service Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy service package files (from repo root context)
COPY services/feed-service/package*.json ./
RUN npm install

# Copy service source
COPY services/feed-service/ ./

EXPOSE 3007

CMD ["npm", "run", "dev"]
