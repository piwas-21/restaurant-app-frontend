'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import type { LibraryStatus } from '@/hooks/admin/useLibraryArchive';
// Shared with the ingredient picker on purpose — the two modals draw the same four states, so a
// second copy of these rules would be a second thing to keep in step (the same reason
// `ProductVariations` shares the ingredient table's stylesheets).
import styles from './GlobalIngredientPickerModal.module.css';

interface LibraryPickerResultsProps {
  status: LibraryStatus;
  loadError: string | null;
  onRetry: () => void;
  /** Nothing matched. The wrapper owns the message so both lists say it the same way. */
  isEmpty: boolean;
  /** Translation key for that message — the two lists are empty for different reasons. */
  emptyKey: string;
  /** Translation key for the retry button — each catalog names itself in its own messages. */
  retryKey: string;
  /** How many matches the cap is hiding, or null when it is hiding none. */
  hiddenNote?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * The four states a library list can be in — loading, unreadable, empty, and a list of rows —
 * around whichever rows the caller renders.
 *
 * One wrapper for the browsable catalog and the archived set of BOTH libraries — ingredients (plan
 * S2) and variations (plan S4). They are read from four endpoints and hold four pieces of state,
 * but a reader must not have to learn four different ways of being told that a list could not be
 * loaded. Every word it renders arrives as a literal translation key from the caller, so
 * `check-t-keys` still sees each one at the call site.
 */
export default function LibraryPickerResults({
  status,
  loadError,
  onRetry,
  isEmpty,
  emptyKey,
  retryKey,
  hiddenNote,
  children,
}: Readonly<LibraryPickerResultsProps>) {
  const { t } = useTranslation();

  if (status === 'loading') return <output className={styles.notice}>{t('searching')}</output>;

  if (status === 'error') {
    return (
      <div className={styles.error} role="alert">
        {loadError}
        <button type="button" className={styles.retryButton} onClick={onRetry}>
          {t(retryKey)}
        </button>
      </div>
    );
  }

  if (isEmpty) return <p className={styles.notice}>{t(emptyKey)}</p>;

  return (
    <>
      <ul className={styles.list}>{children}</ul>
      {hiddenNote}
    </>
  );
}
