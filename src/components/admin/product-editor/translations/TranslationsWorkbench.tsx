'use client';

import React, { useCallback, useEffect } from 'react';
import { AlertTriangle, CheckCircle2, Copy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import StatusBadge from '@/components/design-system/StatusBadge';
import { LANGUAGE_CODES, getLanguageNativeName } from '@/config/languageConfig';
import { directionFor } from '@/lib/textDirection';
import { TRANSLATION_SOURCE_BASE, useTranslationsWorkbench } from '@/hooks/admin/useTranslationsWorkbench';
import type { useProductEditorForm } from '@/hooks/admin/useProductEditorForm';
import TranslationLocaleRail from './TranslationLocaleRail';
import TranslationSlotRows from './TranslationSlotRows';
import type { ProductContentRow, TranslationSlot } from './translationSlots';
import styles from './TranslationsWorkbench.module.css';

/** Named so the label can point at it — the control it replaces had no accessible name at all. */
const SOURCE_SELECT_ID = 'editor-translations-source-language';

interface TranslationsWorkbenchProps {
  // readonly: S6759 — component props are never mutated.
  readonly editor: ReturnType<typeof useProductEditorForm>;
}

/** One react-hook-form error, read without an `any` (CLAUDE.md §5 rule 8). */
interface FieldErrorLike {
  readonly message?: unknown;
}

/**
 * The Translations tab (MENU-ITEM-EDITOR-REDESIGN-PLAN D2, slice S4) — approved screen
 * `translations_workbench_margherita_pizza`.
 *
 * ONE locale switcher for every translatable string on the item. It replaces all three of the
 * editor's old translation UIs: the product's per-language row list, the `<details>` grid on every
 * variation, and the second `<details>` grid on every ingredient. Those three disagreed about which
 * locales exist and about what "translated" means, and none of them could answer the only question
 * an admin actually has — *which languages are still missing?*
 *
 * Two counts, and they are not the same number: the rail says how much of EACH language is written,
 * the badge says how much of the SELECTED one is not. The first is what makes the admin pick a
 * language; the second is what tells them when to stop.
 *
 * ⚠️ Neither count may ever become an i18next plural. `check-locale-parity.mjs` requires one key set
 * across ten bundles while Russian needs three plural categories and Arabic six, so a correct plural
 * set is a parity failure by construction (plan §12.4). Both strings keep the NUMBER LAST for the
 * same reason — "{{count}} missing" would force gender/number agreement in fr, de, ru and it.
 */
export default function TranslationsWorkbench({ editor }: TranslationsWorkbenchProps) {
  const { t } = useTranslation();
  const workbench = useTranslationsWorkbench(editor);
  const { slots, progress, targetLocale, sourceLocale, missing, lastCopy } = workbench;
  const { errors } = editor.form.formState;

  /** `errors.content` is indexed by ROW of the content array, which is how both readers below key. */
  const contentErrors = errors.content as unknown as
    ReadonlyArray<Readonly<Record<string, FieldErrorLike | undefined>>> | undefined;

  /**
   * The resolver's own sentence for the one refusal this panel can produce: `contentSchema.name` is
   * `min(1)`, so a locale given a description and no name blocks Save. The old list left that
   * message on a screen the admin had no reason to open; here it renders on the field it is about.
   */
  const errorFor = useCallback(
    (slot: TranslationSlot): string | undefined => {
      if (slot.ref.target !== 'item') return undefined;
      const rows = (editor.form.getValues('content') ?? []) as ProductContentRow[];
      const row = rows.findIndex((entry) => entry.language === targetLocale);
      if (row === -1) return undefined;

      const message = contentErrors?.[row]?.[slot.ref.field]?.message;
      return typeof message === 'string' ? message : undefined;
    },
    [contentErrors, editor.form, targetLocale],
  );

  /**
   * Follow the save bar's jump to the LOCALE that is refusing, not just to the tab.
   *
   * S7/D13 focuses `[name="content.N.name"]`, and the panel renders one row per string for the
   * SELECTED language only — so a German error while the rail sits on French had a tab switch, a
   * correct field name, and nothing on screen to focus. The switch is deferred a tick there, which
   * is what lets this run first.
   *
   * It only ever moves the rail when the CURRENT language is clean, so it cannot pull an admin off
   * a language they are still fixing.
   */
  useEffect(() => {
    if (!contentErrors) return;
    const rows = (editor.form.getValues('content') ?? []) as ProductContentRow[];
    const stillWrong = (locale: string) => {
      const row = rows.findIndex((entry) => entry.language === locale);
      return row !== -1 && contentErrors[row] !== undefined;
    };
    if (stillWrong(targetLocale)) return;

    const firstBad = rows.findIndex((_, row) => contentErrors[row] !== undefined);
    const locale = rows[firstBad]?.language;
    if (typeof locale === 'string' && locale !== targetLocale) workbench.setTargetLocale(locale);
  }, [contentErrors, editor.form, targetLocale, workbench]);

  /**
   * The form path behind a target cell. Only the two shapes react-hook-form really holds get one:
   * an ingredient lives in plain `useState`, so it has no form path to name and no resolver error
   * to jump to.
   */
  const targetNameFor = useCallback(
    (slot: TranslationSlot): string | undefined => {
      if (slot.ref.target === 'variation') {
        return `variations.${slot.ref.index}.content.${targetLocale}.${slot.ref.field}`;
      }
      if (slot.ref.target !== 'item') return undefined;
      const rows = (editor.form.getValues('content') ?? []) as ProductContentRow[];
      const row = rows.findIndex((entry) => entry.language === targetLocale);
      return row === -1 ? undefined : `content.${row}.${slot.ref.field}`;
    },
    [editor.form, targetLocale],
  );

  /**
   * Validate the field the admin just left. Only the two paths react-hook-form owns can be
   * triggered; an ingredient is plain `useState` and has no resolver rule to run.
   */
  const onBlurSlot = useCallback(
    (slot: TranslationSlot) => {
      if (slot.ref.target === 'item') void editor.form.trigger('content');
      else if (slot.ref.target === 'variation') void editor.form.trigger(`variations.${slot.ref.index}`);
    },
    [editor.form],
  );

  const complete = slots.length > 0 && missing === 0;

  /**
   * The source column's heading names what is IN it. The item's own text declares no language, so
   * on `base` it borrows the picker's own label rather than asserting one — the alternative was to
   * leave `{{language}}` uninterpolated, which renders the braces to the admin.
   */
  const sourceName =
    sourceLocale === TRANSLATION_SOURCE_BASE
      ? t('editor_translations_source_base')
      : getLanguageNativeName(sourceLocale);

  return (
    <div className={styles.workbench}>
      <TranslationLocaleRail
        locales={LANGUAGE_CODES}
        progress={progress}
        activeLocale={targetLocale}
        onSelect={workbench.setTargetLocale}
      />

      <div className={styles.main}>
        <div className={styles.toolbar}>
          <div className={styles.sourcePicker}>
            <label htmlFor={SOURCE_SELECT_ID} className={styles.sourceLabel}>
              {t('editor_translations_source_language')}
            </label>
            <select
              id={SOURCE_SELECT_ID}
              className={styles.sourceSelect}
              value={sourceLocale}
              onChange={(event) => workbench.setSourceLocale(event.target.value)}
            >
              <option value={TRANSLATION_SOURCE_BASE}>{t('editor_translations_source_base')}</option>
              {LANGUAGE_CODES.map((locale) => (
                <option key={locale} value={locale}>
                  {getLanguageNativeName(locale)} {progress[locale]?.done ?? 0}/{progress[locale]?.total ?? 0}
                </option>
              ))}
            </select>
          </div>

          <StatusBadge tone={complete ? 'success' : 'warning'} className={styles.missingBadge}>
            {complete ? <CheckCircle2 size={14} aria-hidden="true" /> : <AlertTriangle size={14} aria-hidden="true" />}
            {complete ? t('editor_translations_all_translated') : t('editor_translations_missing', { count: missing })}
          </StatusBadge>

          <button type="button" className={styles.copyButton} onClick={workbench.copySourceToEmpty}>
            <Copy size={14} aria-hidden="true" />
            {t('editor_translations_copy_source')}
          </button>
        </div>

        {/* Mounted at all times, empty. A live region inserted together with its text is not
            reliably announced — the same rule the editor's error summary follows. */}
        <p className="sr-only" aria-live="polite">
          {lastCopy === null
            ? ''
            : lastCopy.filled > 0
              ? t('editor_translations_copied', { count: lastCopy.filled })
              : t('editor_translations_nothing_to_copy')}
        </p>

        {slots.length === 0 ? (
          <p className={styles.empty}>{t('editor_translations_empty', { tab: t('item') })}</p>
        ) : (
          <TranslationSlotRows
            slots={slots}
            targetLocale={targetLocale}
            sourceTextFor={workbench.sourceTextFor}
            sourceName={sourceName}
            /* The item's own text declares no language, so let the browser infer from the first
               strong character rather than assert a wrong one. */
            sourceDirection={sourceLocale === TRANSLATION_SOURCE_BASE ? 'auto' : directionFor(sourceLocale)}
            onChange={(ref, value) => workbench.setTranslation(ref, targetLocale, value)}
            errorFor={errorFor}
            targetNameFor={targetNameFor}
            onBlurSlot={onBlurSlot}
          />
        )}
      </div>
    </div>
  );
}
