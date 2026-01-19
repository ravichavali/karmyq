# Notification Service Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy service package files (from repo root context)
COPY services/notification-service/package*.json ./
RUN npm install

# Copy service source
COPY services/notification-service/ ./

EXPOSE 3005

CMD ["npm", "run", "dev"]
