'use client';

import React from 'react';
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
            onChange: (event: React.ChangeEvent<HTMLInputElement>) => onSearch(event.target.value),
            onBlur: () => setTimeout(onCloseSuggestions, 200),
          })}
          {...fieldAria(errors, path)}
        />
        <VariationNameSuggestions rows={suggestions} onPick={onPick} />
      </div>
      {/* S7/D13. `variationSchema.name` is `min(1)`, so a blank one refuses the WHOLE save — and
          until S7 nothing rendered a message, which is why the editor could refuse with nothing on
          screen anywhere (plan §12.1). The `aria-label` above stays: it is the accessible NAME, and
          `fieldAria` only adds the invalid state and the pointer to this sentence. */}
      <FieldError name={path} message={fieldMessage(errors, path)} />
    </td>
  );
}
