FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Set Next.js to use polling for file changes in Docker (better for Windows)
ENV CHOKIDAR_USEPOLLING=false
ENV WATCHPACK_POLLING=false

# Pre-build to create .next directory and cache
RUN npm run build

EXPOSE 3000

# Use npm start (serves production build) for better performance
# For development with hot reload, use: npm run dev
CMD ["npm", "start"]
