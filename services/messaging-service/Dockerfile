# Messaging Service Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy service package files (from repo root context)
COPY services/messaging-service/package*.json ./
RUN npm install

# Copy service source
COPY services/messaging-service/ ./

EXPOSE 3006

CMD ["npm", "run", "dev"]
