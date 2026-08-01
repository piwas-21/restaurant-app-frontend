'use client';

import { useEffect } from 'react';

/**
 * The last-resort boundary (BUGS-IMPROVEMENTS-PLAN D2) — the one that catches an error
 * thrown by the ROOT LAYOUT itself, which `app/error.tsx` cannot: that boundary lives
 * inside the layout it would need to render.
 *
 * Everything about this file is constrained by what is guaranteed to be gone when it runs:
 *
 *  - it must render its own `<html>` and `<body>`, because it REPLACES the root layout;
 *  - there is no `ClientProviders`, so **no i18n** — `useTranslation` here would throw
 *    inside the boundary that exists to catch throwing. The copy is hardcoded English on
 *    purpose, and that is the right trade: the alternative to English is a blank document.
 *    This is the one deliberate exception to the "never hardcode strings" rule (CLAUDE.md
 *    §10), and it is why the copy is kept to a single plain sentence;
 *  - there is no template `Shell`, so no chrome and no CSS module — the token layer is
 *    imported by the layout this replaces. Styling is therefore minimal and inline, which
 *    is also the one place the inline-style rule cannot apply.
 *
 * Reaching this file at all means the layout is broken for everyone, not just this user, so
 * the only useful action offered is a full reload.
 */
export default function GlobalError({
  error,
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  useEffect(() => {
    console.error('Root layout failed — rendered by app/global-error.tsx', error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0 }}>
        <main
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem',
            minHeight: '100vh',
            padding: '2rem 1.5rem',
            textAlign: 'center',
          }}
        >
          <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Something went wrong</h1>
          <p style={{ margin: 0, maxWidth: '32rem' }}>This site could not be loaded. Please try again in a moment.</p>
          {error.digest && (
            <p style={{ margin: 0, fontFamily: 'ui-monospace, monospace' }}>Reference: {error.digest}</p>
          )}
          <button type="button" onClick={reset} style={{ padding: '0.625rem 1.25rem', font: 'inherit' }}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
