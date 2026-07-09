// Sentry — server (Node runtime) init. Loaded by src/instrumentation.ts.
// SERVER-SIDE ONLY: browser error capture is intentionally NOT wired here,
// because it would require adding the Sentry ingest origin to the CSP
// connect-src in next.config.ts — a §9 hard-refusal (explicit-instruction-only)
// on this LIVE client prod. This captures SSR / route-handler / RSC errors.
// DSN comes from env; unset => the SDK is a no-op (inert until SENTRY_DSN is set).
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),
  environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  // Error tracking only for now — tracing off (cost/noise).
  tracesSampleRate: 0,
  // Never let the SDK attach request bodies/headers (PII).
  sendDefaultPii: false,
});
