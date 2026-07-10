// Next.js instrumentation hook — loads the Sentry runtime configs at server
// startup and forwards nested Server Component / route-handler errors to Sentry.
// Native Next 15 feature; no-op when SENTRY_DSN is unset. Server-side only:
// browser capture is deferred (it needs a CSP change — a §9 hard refusal here).
import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export const onRequestError = Sentry.captureRequestError;
