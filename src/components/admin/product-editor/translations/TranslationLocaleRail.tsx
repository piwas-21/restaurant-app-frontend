'use client';

import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getLanguageNativeName } from '@/config/languageConfig';
import { isLocaleComplete, type LocaleProgress } from './translationSlots';
import styles from './TranslationLocaleRail.module.css';

interface TranslationLocaleRailProps {
  // readonly: S6759 — component props are never mutated.
  readonly locales: readonly string[];
  readonly progress: Readonly<Record<string, LocaleProgress>>;
  readonly activeLocale: string;
  readonly onSelect: (locale: string) => void;
}

/**
 * The workbench's target-language list (approved screen `translations_workbench_margherita_pizza`).
 *
 * Every locale carries its own completeness, which is the point of the rail: the admin picks the
 * language that still needs work instead of opening ten `<details>` panels to find out. A finished
 * language shows a tick, an unfinished one `8/12`.
 *
 * The name is the button's own TEXT, never an `aria-label` — the visible words have to be part of
 * the accessible name (WCAG 2.5.3), so the progress sentence rides along in an `sr-only` span and
 * the terse `8/12` beside it is hidden from the accessibility tree as a duplicate.
 *
 * It is a `nav` of buttons rather than a second `tablist`: the two tabs of D2 are the only tabs on
 * this page, and the shell's own section nav set that precedent for the same reason.
 */
export default function TranslationLocaleRail({
  locales,
  progress,
  activeLocale,
  onSelect,
}: TranslationLocaleRailProps) {
  const { t } = useTranslation();
  const label = t('editor_translations_target_languages');

  return (
    <nav className={styles.rail} aria-label={label}>
      <h3 className={styles.heading}>{label}</h3>
      <ul className={styles.list}>
        {locales.map((locale) => {
          const localeProgress = progress[locale] ?? { done: 0, total: 0 };
          const complete = isLocaleComplete(localeProgress);
          const isActive = locale === activeLocale;

          return (
            <li key={locale}>
              <button
                type="button"
                className={`${styles.entry} ${isActive ? styles.entryActive : ''}`}
                aria-current={isActive ? 'true' : undefined}
                onClick={() => onSelect(locale)}
              >
                <span className={styles.native}>{getLanguageNativeName(locale)}</span>
                <span className={styles.code} aria-hidden="true">
                  {locale.toUpperCase()}
                </span>
                <span className="sr-only">
                  {complete
                    ? t('editor_translations_all_translated')
                    : t('editor_translations_progress', { done: localeProgress.done, total: localeProgress.total })}
                </span>
                {complete ? (
                  <CheckCircle2 size={16} className={styles.done} aria-hidden="true" />
                ) : (
                  <span className={styles.count} aria-hidden="true">
                    {localeProgress.done}/{localeProgress.total}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
