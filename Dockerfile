# Install dependencies only when needed
FROM node:22-alpine AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN npm ci && npm cache clean --force

# Rebuild the source code only when needed
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build arguments for environment variables
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_IMAGE_BASE_URL
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ARG NEXT_PUBLIC_RESTAURANT_NAME
# UI template baked into this image (ADR-006): classic | craft.
# Empty/unset falls back to classic in next.config.ts.
ARG NEXT_PUBLIC_TEMPLATE
# ISO 4217 currency code baked into price formatting (registry `currency:` →
# build-tenant-image.yml `currency` input). Empty/unset/invalid falls back to
# CHF in src/lib/config.ts, keeping the default (RUMI) build byte-identical.
ARG NEXT_PUBLIC_TENANT_CURRENCY

# Set environment variables for the build
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_IMAGE_BASE_URL=${NEXT_PUBLIC_IMAGE_BASE_URL}
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=${NEXT_PUBLIC_GOOGLE_CLIENT_ID}
ENV NEXT_PUBLIC_RESTAURANT_NAME=${NEXT_PUBLIC_RESTAURANT_NAME}
ENV NEXT_PUBLIC_TEMPLATE=${NEXT_PUBLIC_TEMPLATE}
ENV NEXT_PUBLIC_TENANT_CURRENCY=${NEXT_PUBLIC_TENANT_CURRENCY}

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the build.
ENV NEXT_TELEMETRY_DISABLED 1

RUN npm run build

# Production image, copy all the files and run next
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Remove the npm CLI bundled in the base image. The runtime uses
# `node server.js` directly (Next.js standalone output) and never invokes npm.
# The bundled npm ships its own transitive deps (glob, minimatch, tar) which
# trivy reports as HIGH/CRITICAL CVEs. Removing npm eliminates those reports
# without affecting runtime. See the security MR description for context.
RUN rm -rf /usr/local/lib/node_modules/npm \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy the necessary files for the production image
COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy the container healthcheck probe explicitly. Next.js output-file-tracing
# only bundles files the app imports into .next/standalone; healthcheck.js is
# invoked solely by the Docker HEALTHCHECK below (never imported), so it is NOT
# in the standalone output and must be copied by hand. Without this the probe
# fails with MODULE_NOT_FOUND and the container is reported unhealthy.
COPY --from=builder --chown=nextjs:nodejs /app/healthcheck.js ./healthcheck.js

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Build identity, baked from CI build-args (see build-image.yml). Server-only
# env (not NEXT_PUBLIC_*) read at request time by /api/version. Default to
# "unknown" so a local `docker build` without args still runs.
ARG GIT_SHA=unknown
ARG BUILD_TIME=unknown
ENV GIT_SHA=$GIT_SHA
ENV BUILD_TIME=$BUILD_TIME

# Add health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

CMD ["node", "server.js"]
