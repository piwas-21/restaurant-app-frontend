'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FieldErrors, FieldValues, UseFormRegister } from 'react-hook-form';
import type { GlobalVariationSummary } from '@/services/globalVariationService';
import FieldError from './fields/FieldError';
import VariationNameSuggestions from './VariationNameSuggestions';
import { fieldAria, fieldMessage } from './fields/fieldAria';
import styles from './ProductIngredientRow.module.css';

interface VariationNameCellProps {
  // readonly: S6759 — component props are never mutated.
  readonly register: UseFormRegister<FieldValues>;
  readonly errors: FieldErrors<FieldValues>;
  readonly index: number;
  readonly suggestions: readonly GlobalVariationSummary[];
  readonly onSearch: (term: string) => void;
  readonly onCloseSuggestions: () => void;
  readonly onPick: (row: GlobalVariationSummary) => void;
}

/**
 * One variation row's NAME cell: the input, the library type-ahead under it, and the message.
 *
 * Split out of `ProductVariations` when the type-ahead arrived and the file reached its §4 limit —
 * the cell is a real unit (a field, its suggestions and its error), and the table around it is a
 * layout.
 */
export default function VariationNameCell({
  register,
  errors,
  index,
  suggestions,
  onSearch,
  onCloseSuggestions,
  onPick,
}: VariationNameCellProps) {
  const { t } = useTranslation();
  const path = `variations.${index}.name`;
  /** Which suggestion the arrow keys are on. -1 is "none", which is where every keystroke puts it. */
  const [activeIndex, setActiveIndex] = useState(-1);
  const listId = `variation-${index}-suggestions`;
  const optionId = (position: number) => `${listId}-${position}`;
  const isOpen = suggestions.length > 0;
  // The list is rebuilt on every keystroke, so a remembered index can outlive the row it named.
  const active = activeIndex < suggestions.length ? activeIndex : -1;

  /**
   * The whole keyboard for this widget, on the INPUT — focus never enters the list.
   *
   * Tab out of the input fires its blur and the blur closes the list, so a focusable suggestion
   * could never be reached: before this, the feature was mouse-only. Enter with nothing highlighted
   * is deliberately left alone — it is the form's, and stealing it would stop the editor saving.
   */
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex(active + 1 >= suggestions.length ? 0 : active + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex(active <= 0 ? suggestions.length - 1 : active - 1);
    } else if (event.key === 'Enter' && active >= 0) {
      event.preventDefault();
      setActiveIndex(-1);
      onPick(suggestions[active]);
    } else if (event.key === 'Escape') {
      setActiveIndex(-1);
      onCloseSuggestions();
    }
  };

  return (
    <td className={styles.nameCell} data-label={t('variation_name')}>
      <div className={styles.nameField}>
        <input
          className={styles.nameInput}
          aria-label={t('variation_name')}
          placeholder={t('variation_name')}
          // BOTH handlers INSIDE `register`, never beside it: a JSX `onBlur` written after the
          // spread OVERRIDES react-hook-form's own — measured, it silently disabled blur validation
          // and a blank name stopped raising "Variation name is required". The same
          // spread-vs-attribute trap `ProductBasicsFields` records for `aria-describedby`. The close
          // is delayed so a click on a suggestion lands before the list is torn down.
          {...register(path, {
            onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
              setActiveIndex(-1);
              onSearch(event.target.value);
            },
            onBlur: () => setTimeout(onCloseSuggestions, 200),
          })}
          onKeyDown={handleKeyDown}
          role="combobox"
          aria-expanded={isOpen}
          // Only while the list EXISTS: a pointer to an absent id is a broken relationship, not an
          // empty one.
          aria-controls={isOpen ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? optionId(active) : undefined}
          {...fieldAria(errors, path)}
        />
        <VariationNameSuggestions
          rows={suggestions}
          onPick={(row) => {
            setActiveIndex(-1);
            onPick(row);
          }}
          listId={listId}
          optionId={optionId}
          activeIndex={active}
        />
      </div>
      {/* S7/D13. `variationSchema.name` is `min(1)`, so a blank one refuses the WHOLE save — and
          until S7 nothing rendered a message, which is why the editor could refuse with nothing on
          screen anywhere (plan §12.1). The `aria-label` above stays: it is the accessible NAME, and
          `fieldAria` only adds the invalid state and the pointer to this sentence. */}
      <FieldError name={path} message={fieldMessage(errors, path)} />
    </td>
  );
}
