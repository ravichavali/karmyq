# Geocoding Service Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy service package files (from repo root context)
COPY services/geocoding-service/package*.json ./
RUN npm install

# Copy service source
COPY services/geocoding-service/ ./

EXPOSE 3009

CMD ["npm", "start"]
