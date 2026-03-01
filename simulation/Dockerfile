FROM node:20-alpine

# Install chromium dependencies (for future Playwright E2E support)
RUN apk add --no-cache postgresql-client

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

# Default: run steady simulation
CMD ["npx", "ts-node", "scripts/run.ts", "--load-profile=steady"]
