# Community Service Dockerfile
FROM node:18-alpine

RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy service package files (from repo root context)
COPY services/community-service/package*.json ./
RUN npm install

# Copy service source
COPY services/community-service/ ./

EXPOSE 3002

CMD ["npm", "run", "dev"]
