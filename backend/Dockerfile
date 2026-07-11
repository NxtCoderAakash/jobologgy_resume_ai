# Puppeteer-ready backend image.
# node:20-slim is Debian bookworm; we install the shared libraries Chromium needs
# and let Puppeteer download its own matched Chromium during `npm ci`.
FROM node:20-slim

# Chromium runtime dependencies (from Puppeteer's Debian troubleshooting list).
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc-s1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libx11-6 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first for better layer caching.
# (NODE_ENV is set AFTER this so devDependencies — tsx, typescript — are installed.)
COPY package*.json ./
RUN npm ci

# App source
COPY . .

ENV NODE_ENV=production
# Render injects its own PORT; this is just the local default.
ENV PORT=8787
EXPOSE 8787

# Run TypeScript directly with tsx (no separate build step needed).
CMD ["npx", "tsx", "src/server.ts"]
