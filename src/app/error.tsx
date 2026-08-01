'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import styles from './styles/ErrorSurface.module.css';

/**
 * The app's error boundary (BUGS-IMPROVEMENTS-PLAN D2).
 *
 * Before this file existed there was no boundary anywhere in `src`, so any unhandled
 * render error took the whole document to Next's built-in *"Application error: a
 * client-side exception has occurred"* — no chrome, no retry, no way back, and nothing
 * written down. That is how a real report arrived with no reproduction attached.
 *
 * It renders in place of the PAGE, inside the root layout, so `ClientProviders` and the
 * template `Shell` are still mounted: the tenant's header and nav stay, exactly as they do
 * on `ModuleRouteGuard`'s blocked-route screen. An error is not a reason to drop the user
 * out of the app.
 *
 * Two things it deliberately does NOT do:
 *
 *  - **report to Sentry.** Browser capture is not wired in this app and wiring it needs the
 *    Sentry ingest origin in the CSP `connect-src` — a §9 hard refusal on a live client
 *    prod. `console.error` is therefore the honest ceiling here, and it is still an
 *    improvement: the default boundary prints a minified React error and drops the cause.
 *    SERVER-side errors are already captured (`instrumentation.ts`), and those are the ones
 *    that arrive carrying `digest` — which is why the digest is shown.
 *  - **swallow the error.** `reset()` re-renders the same subtree; if the cause is still
 *    there the boundary comes straight back, which is the truthful outcome.
 */
export default function AppError({
  error,
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  const { t } = useTranslation();

  // Keep the real error in the console. The default boundary replaces it with a minified
  // React message, so without this the one artefact a user could send us is degraded.
  useEffect(() => {
    console.error('Unhandled error rendered by app/error.tsx', error);
  }, [error]);

  return (
    // A <section>, not a <main>: the template Shell around this already supplies the
    // page's <main> landmark, and two would leave a screen reader with an ambiguous
    // document structure. Same reasoning as ModuleRouteGuard.
    <section className={styles.container}>
      <AlertTriangle className={styles.iconError} size={48} aria-hidden="true" />
      <h1 className={styles.title}>{t('error_boundary_title', 'Something went wrong')}</h1>
      <p className={styles.message}>
        {t('error_boundary_message', 'This page could not be displayed. Trying again often fixes it.')}
      </p>
      {/* Only ever present on an error that came from the server, where Sentry already has
          the matching event. Rendering the label unconditionally would promise a reference
          that does not exist for client-side failures. */}
      {error.digest && (
        <p className={styles.digest}>
          {t('error_boundary_reference', 'Reference')}: {error.digest}
        </p>
      )}
      <div className={styles.actions}>
        <button type="button" className={styles.primaryAction} onClick={reset}>
          {t('error_boundary_retry', 'Try again')}
        </button>
        <Link href="/" className={styles.secondaryAction}>
          {t('error_boundary_home', 'Back to home')}
        </Link>
      </div>
    </section>
  );
}
