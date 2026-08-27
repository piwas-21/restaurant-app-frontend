'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import type { LibraryStatus } from '@/hooks/admin/useGlobalIngredientLibrary';
import styles from './GlobalIngredientPickerModal.module.css';

interface GlobalIngredientPickerResultsProps {
  status: LibraryStatus;
  loadError: string | null;
  onRetry: () => void;
  /** Nothing matched. The wrapper owns the message so both lists say it the same way. */
  isEmpty: boolean;
  /** Translation key for that message — the two lists are empty for different reasons. */
  emptyKey: string;
  /** How many matches the cap is hiding, or null when it is hiding none. */
  hiddenNote?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * The four states a library list can be in — loading, unreadable, empty, and a list of rows —
 * around whichever rows the caller renders.
 *
 * One wrapper for the browsable catalog and the archived set: they are read from two endpoints and
 * hold two pieces of state, but a reader must not have to learn two different ways of being told
 * that a list could not be loaded.
 */
export default function GlobalIngredientPickerResults({
  status,
  loadError,
  onRetry,
  isEmpty,
  emptyKey,
  hiddenNote,
  children,
}: Readonly<GlobalIngredientPickerResultsProps>) {
  const { t } = useTranslation();

  if (status === 'loading') return <output className={styles.notice}>{t('searching')}</output>;

  if (status === 'error') {
    return (
      <div className={styles.error} role="alert">
        {loadError}
        <button type="button" className={styles.retryButton} onClick={onRetry}>
          {t('ingredient_library_retry')}
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
