# Environment Configuration Guide

This guide explains how to configure environment variables for different environments (local development, staging, production).

## Environment Files

- `.env.example` - Template file with all available environment variables
- `.env.local` - Local development environment (not committed to git)
- `.env.production` - Production environment (committed to git)

## Environment Variables

### `NEXT_PUBLIC_API_URL`
The base URL for the backend API.

- **Local Development**: `http://localhost:5221` (or your backend port)
- **Production**: `https://rumirestaurant.ch/api`

### `NEXT_PUBLIC_IMAGE_BASE_URL`
The base URL for serving images and assets.

- **Local Development**: `http://localhost:5221` (same-origin as the dev backend, serves `/uploads`)
- **Production**: `https://www.rumirestaurant.ch` (baked by `build-image.yml`; per-tenant images bake their own domain)

## Setup Instructions

### For Local Development

1. Copy the example file:
   ```bash
   cp .env.example .env.local
   ```

2. Update `.env.local` with your local backend URL:
   ```bash
   NEXT_PUBLIC_API_URL=http://localhost:5221
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

### For Production

**There is nothing to run.** `NEXT_PUBLIC_*` values are baked into the JavaScript bundle at
**image build time**, and the only thing that builds a production image is
`.github/workflows/build-image.yml`, which passes them as Docker build args:

```yaml
NEXT_PUBLIC_API_URL=https://www.rumirestaurant.ch
NEXT_PUBLIC_IMAGE_BASE_URL=https://www.rumirestaurant.ch
```

A merge to `main` publishes `:latest` and `deploy.yml` rolls the prod box. Staging bakes
`STAGING_PUBLIC_URL` the same way; a **per-tenant** image bakes that tenant's own domain from the
registry (`build-tenant-image.yml`), which is why a tenant frontend is *rebuilt* rather than pulled
when its domain changes.

`.env.production` is still live — Next reads it automatically for a production build, and CI's
bundle-size job keys its cache on it — but nothing deploys *from* it.

## How It Works

### During development (`npm run dev`)
Next.js loads `.env.local`, falling back to `.env`.

### During the Docker build
The Dockerfile takes the values as build arguments and freezes them into the bundle:

```dockerfile
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_IMAGE_BASE_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_IMAGE_BASE_URL=${NEXT_PUBLIC_IMAGE_BASE_URL}
```

### At runtime
Nothing reads them. Caddy on the box routes `/api/*` and `/uploads/*` to the backend and everything
else to the frontend container — see `deploy/Caddyfile`, which is the only description of that
routing that is kept in step with the machine it runs on.

## Important notes

⚠️ **`NEXT_PUBLIC_*` is embedded at BUILD time, not runtime.** So:

1. Changing a production value means **rebuilding the image**, not restarting a container.
2. A tenant's frontend image must be rebuilt when its domain changes — a restart does nothing.
3. Anything that must vary at runtime cannot be a `NEXT_PUBLIC_*` variable; it has to come from an
   API response or a server component.

## Troubleshooting

### The API is not reachable in production

1. Check what the bundle was actually built with: `GET /api/frontend/version` reports the commit and
   build time of both services — the fastest way to tell a stale image from a wrong URL.
2. Check Caddy is routing `/api/*` to the backend: `deploy/Caddyfile`, and `docker logs deploy-caddy-1`
   on the box.
3. `curl https://www.rumirestaurant.ch/api/version`.

### A changed environment variable has not taken effect

It never will without a rebuild — see the note above. Merge to `main` (or dispatch
`build-image.yml`), then confirm on `/api/frontend/version` rather than on a workflow's exit code.

## Additional resources

- [Next.js environment variables](https://nextjs.org/docs/app/guides/environment-variables)
- [Docker build arguments](https://docs.docker.com/engine/reference/builder/#arg)
- `deploy/DEPLOYMENT.md` — the canonical deploy + rollback runbook
