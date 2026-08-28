'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { getLanguageNativeName } from '@/config/languageConfig';
import { directionFor } from '@/lib/textDirection';
import {
  isBlank,
  translationIn,
  type TranslationGroupId,
  type TranslationSlot,
  type TranslationSlotRef,
} from './translationSlots';
import styles from './TranslationsWorkbench.module.css';

/** One shared description for every empty target field — an id may be referenced many times. */
export const UNTRANSLATED_HINT_ID = 'editor-translations-untranslated-hint';

/**
 * The three group headings are the bundles' OWN nouns, not new ones. `item` is already the label of
 * the tab beside this one, so the workbench and the shell cannot drift apart in any locale.
 */
const GROUP_LABELS: Record<TranslationGroupId, string> = {
  item: 'item',
  variations: 'variations',
  ingredients: 'ingredients',
};

const GROUP_ORDER: readonly TranslationGroupId[] = ['item', 'variations', 'ingredients'];

interface TranslationSlotRowsProps {
  // readonly: S6759 — component props are never mutated.
  readonly slots: readonly TranslationSlot[];
  readonly targetLocale: string;
  readonly sourceTextFor: (slot: TranslationSlot) => string;
  /** What to CALL the source column — a language's native name, or the base text's own label. */
  readonly sourceName: string;
  readonly sourceDirection: 'ltr' | 'rtl' | 'auto';
  readonly onChange: (ref: TranslationSlotRef, value: string) => void;
  readonly errorFor: (slot: TranslationSlot) => string | undefined;
  /** The form path a slot's target cell writes, or `undefined` when it has no row yet. */
  readonly targetNameFor: (slot: TranslationSlot) => string | undefined;
  /** Leaving a cell validates it — these inputs are not registered, so nothing else would. */
  readonly onBlurSlot: (slot: TranslationSlot) => void;
}

/**
 * The source-beside-target grid of the approved workbench screen: one row per translatable string,
 * grouped `Item` · `Variations` · `Ingredients`.
 *
 * Two shapes here answer the ten-locale, RTL reality the screen could not draw. The grid itself
 * stays in the PAGE's direction — it is admin chrome, and mirroring it per target language would
 * move the columns under the admin every time they picked a language. The direction that does
 * change is the TEXT's: each column carries its own `dir`, so Arabic is typed right-to-left inside
 * a left-to-right page, which is what a translator actually needs. The source column reads `auto`
 * when it shows the item's own text, because that text carries no declared language.
 *
 * Every input is named by a real `<label>` rather than an `aria-label`. The visible naming here is
 * the column head plus the group heading, which is a spatial relationship no assistive technology
 * infers, so the label is visually hidden and the row still states what it is.
 */
export default function TranslationSlotRows({
  slots,
  targetLocale,
  sourceTextFor,
  sourceName,
  sourceDirection,
  onChange,
  errorFor,
  targetNameFor,
  onBlurSlot,
}: TranslationSlotRowsProps) {
  const { t } = useTranslation();
  const targetDirection = directionFor(targetLocale);
  const targetName = getLanguageNativeName(targetLocale);

  const renderSlot = (slot: TranslationSlot) => {
    const fieldName = t(slot.fieldLabel);
    const source = sourceTextFor(slot);
    const value = translationIn(slot, targetLocale);
    const error = errorFor(slot);
    const sourceId = `translation-${slot.key}-source`;
    const targetId = `translation-${slot.key}-target`;
    const errorId = `${targetId}-error`;
    const SourceTag = slot.multiline ? 'textarea' : 'input';
    const TargetTag = slot.multiline ? 'textarea' : 'input';

    return (
      <div key={slot.key} className={styles.row}>
        <div className={styles.cell}>
          <label className="sr-only" htmlFor={sourceId}>
            {t('editor_translations_source_field', { field: fieldName })}
          </label>
          <SourceTag
            id={sourceId}
            className={styles.source}
            dir={sourceDirection}
            readOnly
            value={source}
            rows={slot.multiline ? 3 : undefined}
          />
        </div>
        <div className={styles.cell}>
          <label className="sr-only" htmlFor={targetId}>
            {t('editor_translations_target_field', { field: fieldName, language: targetName })}
          </label>
          <TargetTag
            id={targetId}
            /* The form path this cell edits, so S7/D13's save-bar jump can FIND it: `focusField`
               resolves `[name="…"]` off the DOM, and an input with no name is a field the error
               summary can name but never reach. The item's row index comes from the caller — it is
               the position in the `content` array, which is how the resolver indexes its errors. */
            name={targetNameFor(slot)}
            className={`${styles.target} ${isBlank(value) ? styles.targetEmpty : ''}`}
            dir={targetDirection}
            value={value}
            rows={slot.multiline ? 3 : undefined}
            placeholder={isBlank(source) ? undefined : t('editor_translations_placeholder', { text: source })}
            aria-describedby={error ? errorId : isBlank(value) ? UNTRANSLATED_HINT_ID : undefined}
            aria-invalid={error ? true : undefined}
            onChange={(event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
              onChange(slot.ref, event.target.value)
            }
            /* S7/D13 validates `onTouched`, which react-hook-form only does for fields it
               REGISTERED — and none of these are: the panel writes through `setValue` so one
               locale switcher can drive three different stores. Without this the resolver's
               refusal appeared for the first time on Save, which is the defect S7 exists to end. */
            onBlur={() => onBlurSlot(slot)}
          />
          {error && (
            <p id={errorId} className={styles.error} role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={styles.grid}>
      <div className={styles.columnHeads}>
        <span className={styles.columnHead}>{t('editor_translations_source_heading', { language: sourceName })}</span>
        <span className={styles.columnHead}>{t('editor_translations_target_heading', { language: targetName })}</span>
      </div>
      <span id={UNTRANSLATED_HINT_ID} className="sr-only">
        {t('editor_translations_not_translated')}
      </span>
      {GROUP_ORDER.map((group) => {
        const inGroup = slots.filter((slot) => slot.group === group);
        if (inGroup.length === 0) return null;

        return (
          <section key={group} className={styles.group} aria-label={t(GROUP_LABELS[group])}>
            <h3 className={styles.groupHeading}>{t(GROUP_LABELS[group])}</h3>
            {inGroup.map(renderSlot)}
          </section>
        );
      })}
    </div>
  );
}
