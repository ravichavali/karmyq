# Geocoding Service Dockerfile
# JavaScript service - no build needed

FROM node:18-alpine
WORKDIR /app
COPY services/geocoding-service/package*.json ./
RUN npm install --omit=dev
COPY services/geocoding-service/ ./
EXPOSE 3009
CMD ["node", "index.js"]
