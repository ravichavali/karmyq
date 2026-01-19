# Request Service Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy service package files (from repo root context)
COPY services/request-service/package*.json ./
RUN npm install

# Copy service source
COPY services/request-service/ ./

EXPOSE 3003

CMD ["npm", "run", "dev"]
