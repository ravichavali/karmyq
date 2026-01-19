# Reputation Service Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy service package files (from repo root context)
COPY services/reputation-service/package*.json ./
RUN npm install

# Copy service source
COPY services/reputation-service/ ./

EXPOSE 3004

CMD ["npm", "run", "dev"]
