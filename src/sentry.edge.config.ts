// Sentry — edge runtime init (middleware / edge routes). Loaded by
// src/instrumentation.ts. Same env-gating as the server config: inert without
// a DSN. Server-side only (see sentry.server.config.ts for why no browser SDK).
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),
  environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  tracesSampleRate: 0,
  sendDefaultPii: false,
});
