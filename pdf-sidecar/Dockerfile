# CradleHQ PDF sidecar — Debian-based on purpose.
# The Spring API image is Alpine/musl and Playwright/Puppeteer's Chromium is glibc-only, so Chromium lives
# here in its own Debian image instead of being forced into the API container.
# See plans/storybook-v2/print/pr1-headless-chrome-spike.md.

FROM node:20-bookworm-slim

# Debian's Chromium + the fonts a keepsake book needs (serif/sans/emoji). Using the distro browser means we
# don't download Chromium via Puppeteer (PUPPETEER_SKIP_DOWNLOAD below).
# ghostscript: the pr5.5 Part B transparency-flatten pass (server.js flattenPdf) shells out to `gs` to make
# Chrome's PDFs Lulu-acceptable. Purely for transparency flattening — not the (dropped) CMYK conversion.
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      ghostscript \
      fonts-liberation \
      fonts-dejavu-core \
      fonts-noto-color-emoji \
      ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production \
    PORT=4000

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY . .

# Generate the offline sample image used by the self-test page.
RUN node lib/generate-sample-png.js public/sample.png

EXPOSE 4000

# Run as the unprivileged 'node' user (Chromium is launched with --no-sandbox in server.js).
USER node

CMD ["node", "server.js"]
